// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BokkyPooBahsDateTimeLibrary as DT} from "datetime/BokkyPooBahsDateTimeLibrary.sol";
import {MockV3Aggregator} from "@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {MarketCalendar} from "../src/MarketCalendar.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {MockUSDG} from "./mocks/MockUSDG.sol";

contract GapMarketTest is Test {
    MarketCalendar cal;
    GapMarket gm;
    MockUSDG usdg;
    MockV3Aggregator feed;

    address maker = makeAddr("maker");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant FRI_CLOSE = 1789776000; // 2026-09-19 00:00 UTC = Fri 20:00 EDT
    uint256 constant SAT_NOON = FRI_CLOSE + 16 hours;
    uint256 constant SUN_REOPEN = FRI_CLOSE + 2 days; // 2026-09-21 00:00 UTC = Sun 20:00 EDT
    int256 constant REF = 180e8; // NVDA $180, 8 decimals like the Robinhood feeds
    uint256 constant B = 1_000e18; // LMSR liquidity

    function setUp() public {
        assertEq(FRI_CLOSE, DT.timestampFromDateTime(2026, 9, 19, 0, 0, 0));
        cal = new MarketCalendar(address(this));
        usdg = new MockUSDG();
        gm = new GapMarket(usdg, cal);
        feed = new MockV3Aggregator(8, REF);
        feed.updateRoundData(1, REF, FRI_CLOSE - 1 minutes, FRI_CLOSE - 1 minutes);

        for (uint256 i; i < 3; ++i) {
            address who = [maker, alice, bob][i];
            usdg.mint(who, 1_000_000e6);
            vm.prank(who);
            usdg.approve(address(gm), type(uint256).max);
        }
        vm.warp(SAT_NOON);
    }

    function edges() internal pure returns (int256[] memory e) {
        e = new int256[](6);
        (e[0], e[1], e[2], e[3], e[4], e[5]) = (-500, -200, -50, 50, 200, 500);
    }

    function create() internal returns (uint256 id) {
        vm.prank(maker);
        id = gm.createMarket(AggregatorV3Interface(address(feed)), edges(), B, 300);
    }

    function test_CreateSnapshotsReferenceAndSchedule() public {
        uint256 balBefore = usdg.balanceOf(maker);
        uint256 id = create();
        GapMarket.Market memory m = gm.getMarket(id);
        assertEq(m.refPrice, REF);
        assertEq(m.closeTs, FRI_CLOSE);
        assertEq(m.reopenTs, SUN_REOPEN);
        // Subsidy b * ln(7) = 1000 * 1.9459 USDG.
        assertApproxEqAbs(balBefore - usdg.balanceOf(maker), 1945.910150e6, 1);
    }

    function test_CannotCreateWhileMarketOpen() public {
        vm.warp(SUN_REOPEN + 1 hours);
        vm.expectRevert(GapMarket.MarketIsOpen.selector);
        create();
    }

    function test_RejectsReferenceUpdatedAfterClose() public {
        feed.updateRoundData(2, REF, FRI_CLOSE + 1 hours, FRI_CLOSE + 1 hours);
        vm.expectRevert(GapMarket.StaleReference.selector);
        create();
    }

    function test_InitialPricesUniformAndMoveCentered() public {
        uint256 id = create();
        uint256[] memory p = gm.prices(id);
        uint256 sum;
        for (uint256 i; i < p.length; ++i) {
            assertApproxEqAbs(p[i], uint256(1e18) / 7, 1e6);
            sum += p[i];
        }
        assertApproxEqAbs(sum, 1e18, 1e6);
        (int256 mean,) = gm.impliedMove(id);
        assertEq(mean, 0);
    }

    function test_BuyingRaisesPriceAndShiftsImpliedMove() public {
        uint256 id = create();
        uint256 quote = gm.quoteBuy(id, 0, 500e18);
        vm.prank(alice);
        uint256 cost = gm.buy(id, 0, 500e18, quote);
        assertEq(cost, quote);
        assertEq(gm.balanceOf(alice, gm.tokenId(id, 0)), 500e18);
        assertGt(gm.prices(id)[0], uint256(1e18) / 7);
        (int256 mean,) = gm.impliedMove(id);
        assertLt(mean, 0, "buying the crash range should drag the implied move down");
    }

    function test_BuyThenSellIsPathIndependent() public {
        uint256 id = create();
        vm.startPrank(alice);
        uint256 cost = gm.buy(id, 3, 200e18, type(uint256).max);
        uint256 back = gm.sell(id, 3, 200e18, 0);
        vm.stopPrank();
        assertLe(back, cost, "never profit from a round trip");
        assertLe(cost - back, 1, "only rounding is lost");
    }

    function test_SlippageProtection() public {
        uint256 id = create();
        uint256 quote = gm.quoteBuy(id, 2, 100e18);
        vm.prank(alice);
        vm.expectRevert(GapMarket.Slippage.selector);
        gm.buy(id, 2, 100e18, quote - 1);
    }

    function test_ResolveRedeemAndResidual() public {
        uint256 id = create();
        vm.prank(alice);
        gm.buy(id, 6, 300e18, type(uint256).max); // "up more than 5%"
        vm.prank(bob);
        gm.buy(id, 2, 300e18, type(uint256).max); // "-2% to -0.5%"

        vm.warp(SUN_REOPEN + 30 seconds);
        vm.expectRevert(GapMarket.TradingClosed.selector);
        vm.prank(alice);
        gm.buy(id, 6, 1e18, type(uint256).max);

        feed.updateRoundData(2, 190e8, SUN_REOPEN + 20 seconds, SUN_REOPEN + 20 seconds); // +5.55%
        gm.resolve(id, 2);
        GapMarket.Market memory m = gm.getMarket(id);
        assertTrue(m.resolved);
        assertEq(m.winner, 6);

        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        gm.redeem(id);
        assertEq(usdg.balanceOf(alice) - before, 300e6);

        vm.prank(bob);
        assertEq(gm.redeem(id), 0, "losers get nothing");

        vm.prank(maker);
        gm.withdrawResidual(id);
        assertEq(usdg.balanceOf(address(gm)), 0, "every unit accounted for");
    }

    function test_CannotResolveBeforeReopen() public {
        uint256 id = create();
        vm.expectRevert(GapMarket.TooEarly.selector);
        gm.resolve(id, 1);
    }

    function test_CannotCherryPickLaterRound() public {
        uint256 id = create();
        vm.warp(SUN_REOPEN + 10 minutes);
        feed.updateRoundData(2, 170e8, SUN_REOPEN + 1 minutes, SUN_REOPEN + 1 minutes);
        feed.updateRoundData(3, 195e8, SUN_REOPEN + 5 minutes, SUN_REOPEN + 5 minutes);
        vm.expectRevert(GapMarket.NotFirstRoundAfterReopen.selector);
        gm.resolve(id, 3);
        gm.resolve(id, 2);
        assertEq(gm.getMarket(id).winner, 0, "-5.55% lands in the crash range");
    }

    function test_CannotResolveWithPreReopenRound() public {
        uint256 id = create();
        vm.warp(SUN_REOPEN + 1 hours);
        vm.expectRevert(GapMarket.NotFirstRoundAfterReopen.selector);
        gm.resolve(id, 1);
    }

    function test_OnlyCreatorWithdrawsResidual() public {
        uint256 id = create();
        vm.warp(SUN_REOPEN + 1 minutes);
        feed.updateRoundData(2, REF, SUN_REOPEN + 1, SUN_REOPEN + 1);
        gm.resolve(id, 2);
        vm.prank(alice);
        vm.expectRevert(GapMarket.NotCreator.selector);
        gm.withdrawResidual(id);
    }

    /// The market stays solvent for any sequence of trades and any settlement price.
    function testFuzz_SolventAfterRandomTrades(uint256 seed, int256 settle) public {
        uint256 id = create();
        for (uint256 i; i < 12; ++i) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            address who = seed % 2 == 0 ? alice : bob;
            uint8 outcome = uint8(seed % 7);
            uint256 amount = bound(seed >> 16, 1e15, 2_000e18);
            vm.prank(who);
            gm.buy(id, outcome, amount, type(uint256).max);
            if (seed % 3 == 0) {
                uint256 bal = gm.balanceOf(who, gm.tokenId(id, outcome));
                vm.prank(who);
                gm.sell(id, outcome, bal / 2, 0);
            }
        }
        settle = bound(settle, 1e8, 1_000e8);
        vm.warp(SUN_REOPEN + 1 minutes);
        feed.updateRoundData(2, settle, SUN_REOPEN + 30, SUN_REOPEN + 30);
        gm.resolve(id, 2);

        vm.prank(alice);
        gm.redeem(id);
        vm.prank(bob);
        gm.redeem(id);
        vm.prank(maker);
        gm.withdrawResidual(id);
        // Nothing owed is left and nothing is missing.
        assertEq(gm.totalSupply(gm.tokenId(id, gm.getMarket(id).winner)), 0);
        assertEq(usdg.balanceOf(address(gm)), gm.getMarket(id).collateralHeld);
    }
}
