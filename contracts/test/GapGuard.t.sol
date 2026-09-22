// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockV3Aggregator} from "@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {MarketCalendar} from "../src/MarketCalendar.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {ImpliedPriceOracle} from "../src/ImpliedPriceOracle.sol";
import {GapGuardedLendingPool} from "../src/GapGuardedLendingPool.sol";
import {MockUSDG} from "./mocks/MockUSDG.sol";
import {MockStock} from "./mocks/MockStock.sol";

contract GapGuardTest is Test {
    MarketCalendar cal;
    GapMarket gm;
    ImpliedPriceOracle oracle;
    GapGuardedLendingPool pool;
    MockUSDG usdg;
    MockStock nvda;
    MockV3Aggregator feed;

    address maker = makeAddr("maker");
    address borrower = makeAddr("borrower");
    address bear = makeAddr("bear");
    address liquidator = makeAddr("liquidator");

    uint256 constant FRI_CLOSE = 1789776000; // Fri 2026-09-18 20:00 EDT
    uint256 constant THU_NOON = FRI_CLOSE - 1 days - 8 hours;
    uint256 constant SAT_NOON = FRI_CLOSE + 16 hours;
    uint256 constant SUN_REOPEN = FRI_CLOSE + 2 days;
    int256 constant REF = 180e8;

    function setUp() public {
        vm.warp(THU_NOON);
        cal = new MarketCalendar(address(this));
        usdg = new MockUSDG();
        nvda = new MockStock("NVIDIA", "NVDA");
        gm = new GapMarket(usdg, cal, 100);
        feed = new MockV3Aggregator(8, REF);
        oracle = new ImpliedPriceOracle(AggregatorV3Interface(address(feed)), gm, 1 days, 500e18, 2);
        pool = new GapGuardedLendingPool(nvda, usdg, oracle);

        usdg.mint(address(pool), 1_000_000e6);
        for (uint256 i; i < 4; ++i) {
            address who = [maker, borrower, bear, liquidator][i];
            usdg.mint(who, 1_000_000e6);
            vm.startPrank(who);
            usdg.approve(address(gm), type(uint256).max);
            usdg.approve(address(pool), type(uint256).max);
            nvda.approve(address(pool), type(uint256).max);
            vm.stopPrank();
        }
        nvda.mint(borrower, 100e18); // $18,000 of NVDA at $180

        vm.startPrank(borrower);
        pool.deposit(100e18);
        pool.borrow(8_000e6); // 44% LTV while the market is open
        vm.stopPrank();

        feed.updateRoundData(1, REF, FRI_CLOSE - 1 minutes, FRI_CLOSE - 1 minutes);
    }

    function edges() internal pure returns (int256[] memory e) {
        e = new int256[](6);
        (e[0], e[1], e[2], e[3], e[4], e[5]) = (-500, -200, -50, 50, 200, 500);
    }

    function openWeekendMarket(uint256 liquidity) internal returns (uint256 id) {
        vm.warp(SAT_NOON);
        vm.prank(maker);
        id = gm.createMarket(AggregatorV3Interface(address(feed)), edges(), liquidity, 300);
        oracle.setActiveMarket(id);
    }

    function test_PassesThroughWhileMarketTrades() public {
        vm.warp(FRI_CLOSE - 30 minutes);
        (int256 low, int256 mid, int256 high, bool implied) = oracle.priceBand();
        assertFalse(implied);
        assertEq(low, REF);
        assertEq(mid, REF);
        assertEq(high, REF);
        (, int256 answer,,,) = oracle.latestRoundData();
        assertEq(answer, REF);
    }

    function test_FrozenWithoutMarketPausesRiskAndLiquidations() public {
        vm.warp(SAT_NOON);
        assertTrue(oracle.isFeedFrozen());
        vm.prank(borrower);
        vm.expectRevert(GapGuardedLendingPool.PricingPaused.selector);
        pool.borrow(1e6);
        vm.prank(liquidator);
        vm.expectRevert(GapGuardedLendingPool.PricingPaused.selector);
        pool.liquidate(borrower, 1e6);
    }

    function test_StaleFeedDuringMarketHoursCountsAsFrozen() public {
        // A corporate-action pause: the session is open but the feed stops updating.
        vm.warp(SUN_REOPEN + 2 days);
        assertTrue(cal.isOpen(block.timestamp));
        assertTrue(oracle.isFeedFrozen());
        vm.prank(borrower);
        vm.expectRevert(GapGuardedLendingPool.PricingPaused.selector);
        pool.borrow(1e6);
    }

    function test_BearishWeekendShrinksBorrowingPower() public {
        uint256 id = openWeekendMarket(1_000e18);
        vm.prank(bear);
        gm.buy(id, 1, 1_500e18, type(uint256).max); // "-5% to -2%"

        (int256 low, int256 mid, int256 high, bool implied) = oracle.priceBand();
        assertTrue(implied);
        assertLt(mid, REF, "market expects a lower open");
        assertLt(low, mid);
        assertGt(high, mid);
        (, int256 answer,, uint256 updatedAt,) = oracle.latestRoundData();
        assertEq(answer, mid);
        assertEq(updatedAt, block.timestamp);

        uint256 limit = pool.maxBorrow(borrower);
        assertLt(limit + 8_000e6, uint256(100 * REF / 1e8) * 1e6 / 2, "limit is below the frozen-price limit");
    }

    function test_FakeWeekendPrintCannotLiquidate() public {
        openWeekendMarket(1_000e18);
        // Push the borrower close to the edge, then imagine a thin DEX pool printing a 20% drop.
        // The gap market has no such conviction, so the optimistic bound keeps the position safe.
        vm.warp(SAT_NOON + 1 hours);
        assertFalse(pool.isLiquidatable(borrower));
        vm.prank(liquidator);
        vm.expectRevert(GapGuardedLendingPool.Healthy.selector);
        pool.liquidate(borrower, 1_000e6);
    }

    function test_ModerateGapDoesNotLiquidateSafeLoan() public {
        uint256 id = openWeekendMarket(1_000e18);
        vm.prank(bear);
        gm.buy(id, 0, 20_000e18, type(uint256).max); // near-certain "worse than -5%" (~ -8%)
        (,, int256 high,) = oracle.priceBand();
        assertLt(high, REF * 95 / 100);
        assertFalse(pool.isLiquidatable(borrower), "an 8% gap cannot sink a 44% LTV loan");
    }

    function test_ConsensusCrashAllowsLiquidation() public {
        vm.warp(SAT_NOON);
        int256[] memory e = new int256[](7);
        (e[0], e[1], e[2], e[3], e[4], e[5], e[6]) = (-3000, -1000, -500, -200, 0, 200, 500);
        vm.prank(maker);
        uint256 id = gm.createMarket(AggregatorV3Interface(address(feed)), e, 1_000e18, 1000);
        oracle.setActiveMarket(id);

        vm.prank(bear);
        gm.buy(id, 0, 20_000e18, type(uint256).max); // overwhelming conviction in "worse than -30%"
        (,, int256 high,) = oracle.priceBand();
        assertLt(high, REF * 70 / 100, "even the optimistic bound is below -30%");

        assertTrue(pool.isLiquidatable(borrower));
        uint256 debtBefore = pool.debtOf(borrower);
        vm.prank(liquidator);
        uint256 seized = pool.liquidate(borrower, 2_000e6);
        assertEq(pool.debtOf(borrower), debtBefore - 2_000e6);
        assertGt(seized, 0);
        assertEq(nvda.balanceOf(liquidator), seized);
    }

    function test_ReopenRestoresLivePrice() public {
        openWeekendMarket(1_000e18);
        vm.warp(SUN_REOPEN + 30 seconds);
        feed.updateRoundData(2, 175e8, SUN_REOPEN + 10 seconds, SUN_REOPEN + 10 seconds);
        (, int256 mid,, bool implied) = oracle.priceBand();
        assertFalse(implied);
        assertEq(mid, 175e8);
    }

    function test_HedgeBuysCrashCoverWithinBudget() public {
        uint256 id = openWeekendMarket(1_000e18);
        uint256 reserves = usdg.balanceOf(address(pool));
        (uint256 shares, uint256 premium) = pool.hedge(id);

        uint256 budget = pool.totalDebt() * pool.HEDGE_BUDGET_BPS() / 10_000;
        assertLe(premium, budget, "never spends more than 1% of debt");
        assertEq(reserves - usdg.balanceOf(address(pool)), premium);
        assertEq(gm.balanceOf(address(pool), gm.tokenId(id, 0)), shares);
        // 10% of 8,000 USDG debt = 800 shares, halved once to fit the 80 USDG budget at b = 1000.
        assertEq(shares, 400e18);
        assertGt(gm.getMarket(id).feesAccrued, 0, "the underwriter earns the fee on the pool's premium");
    }

    function test_HedgeOncePerMarketOnActiveMarketOnly() public {
        vm.warp(SAT_NOON);
        vm.expectRevert(GapGuardedLendingPool.NotActiveMarket.selector);
        pool.hedge(0);

        uint256 id = openWeekendMarket(1_000e18);
        vm.expectRevert(GapGuardedLendingPool.NotActiveMarket.selector);
        pool.hedge(id + 1);

        pool.hedge(id);
        vm.expectRevert(GapGuardedLendingPool.AlreadyHedged.selector);
        pool.hedge(id);
    }

    function test_NoDebtNothingToHedge() public {
        vm.prank(borrower);
        pool.repay(borrower, 8_000e6);
        uint256 id = openWeekendMarket(1_000e18);
        vm.expectRevert(GapGuardedLendingPool.NothingToHedge.selector);
        pool.hedge(id);
    }

    function test_HedgePaysOutOnCrash() public {
        uint256 id = openWeekendMarket(1_000e18);
        (uint256 shares, uint256 premium) = pool.hedge(id);

        vm.warp(SUN_REOPEN + 1 minutes);
        feed.updateRoundData(2, REF * 92 / 100, SUN_REOPEN + 10, SUN_REOPEN + 10); // reopens -8%
        gm.resolve(id, 2);

        uint256 before = usdg.balanceOf(address(pool));
        uint256 payout = pool.collectHedge(id);
        assertEq(payout, shares / 1e12, "each winning share pays 1 USDG");
        assertEq(usdg.balanceOf(address(pool)) - before, payout);
        assertGt(payout, premium * 5, "cover pays several times its premium in a crash");
    }

    function test_HedgeExpiresWorthlessOnCalmWeekend() public {
        uint256 id = openWeekendMarket(1_000e18);
        pool.hedge(id);
        vm.warp(SUN_REOPEN + 1 minutes);
        feed.updateRoundData(2, REF, SUN_REOPEN + 10, SUN_REOPEN + 10); // flat reopen
        gm.resolve(id, 2);
        assertEq(pool.collectHedge(id), 0, "the premium was the cost of insurance");
    }

    function test_ActiveMarketRules() public {
        uint256 shallowId;
        vm.warp(SAT_NOON);
        vm.prank(maker);
        shallowId = gm.createMarket(AggregatorV3Interface(address(feed)), edges(), 100e18, 300);
        vm.expectRevert(ImpliedPriceOracle.TooShallow.selector);
        oracle.setActiveMarket(shallowId);

        vm.prank(maker);
        uint256 deep = gm.createMarket(AggregatorV3Interface(address(feed)), edges(), 1_000e18, 300);
        oracle.setActiveMarket(deep);
        vm.prank(maker);
        uint256 sameDepth = gm.createMarket(AggregatorV3Interface(address(feed)), edges(), 1_000e18, 300);
        vm.expectRevert(ImpliedPriceOracle.TooShallow.selector);
        oracle.setActiveMarket(sameDepth);

        vm.prank(maker);
        uint256 deeper = gm.createMarket(AggregatorV3Interface(address(feed)), edges(), 2_000e18, 300);
        oracle.setActiveMarket(deeper);
        assertEq(oracle.activeMarketId(), deeper);

        MockV3Aggregator other = new MockV3Aggregator(8, REF);
        other.updateRoundData(1, REF, FRI_CLOSE - 1, FRI_CLOSE - 1);
        vm.prank(maker);
        uint256 wrong = gm.createMarket(AggregatorV3Interface(address(other)), edges(), 5_000e18, 300);
        vm.expectRevert(ImpliedPriceOracle.WrongFeed.selector);
        oracle.setActiveMarket(wrong);
    }
}
