// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, stdJson} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {MarketCalendar} from "../src/MarketCalendar.sol";
import {MirroredFeed} from "../src/MirroredFeed.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {ImpliedPriceOracle} from "../src/ImpliedPriceOracle.sol";
import {GapGuardedLendingPool} from "../src/GapGuardedLendingPool.sol";

/// @notice End-to-end rehearsal against the contracts actually deployed on Robinhood Chain testnet.
/// Forks the live chain, moves to the coming weekend, and plays out a full closure: the feed freezes,
/// a market opens, traders price the reopen, lending follows the band, and the market settles.
/// Run with: forge test --match-contract ForkedWeekend --fork-url robinhood_testnet
contract ForkedWeekendTest is Test {
    using stdJson for string;

    MarketCalendar cal;
    MirroredFeed feed;
    GapMarket gm;
    ImpliedPriceOracle oracle;
    GapGuardedLendingPool pool;
    IERC20 usdg;
    IERC20 tsla;

    address relayer;
    address maker = makeAddr("maker");
    address bear = makeAddr("bear");
    address borrower = makeAddr("borrower");

    function setUp() public {
        // Only meaningful against a fork of the live testnet.
        vm.skip(block.chainid != 46630);
        string memory json = vm.readFile("./deployments/46630.json");
        cal = MarketCalendar(json.readAddress(".calendar"));
        feed = MirroredFeed(json.readAddress(".feed"));
        gm = GapMarket(json.readAddress(".gapMarket"));
        oracle = ImpliedPriceOracle(json.readAddress(".oracle"));
        pool = GapGuardedLendingPool(json.readAddress(".lendingPool"));
        usdg = IERC20(json.readAddress(".usdg"));
        tsla = IERC20(json.readAddress(".stock"));
        relayer = feed.owner();

        deal(address(usdg), maker, 5_000e6);
        deal(address(usdg), bear, 5_000e6);
        deal(address(usdg), address(pool), 50_000e6);
        deal(address(tsla), borrower, 10e18);
        for (uint256 i; i < 3; ++i) {
            address who = [maker, bear, borrower][i];
            vm.startPrank(who);
            usdg.approve(address(gm), type(uint256).max);
            usdg.approve(address(pool), type(uint256).max);
            tsla.approve(address(pool), type(uint256).max);
            vm.stopPrank();
        }
    }

    function edges() internal pure returns (int256[] memory e) {
        e = new int256[](6);
        (e[0], e[1], e[2], e[3], e[4], e[5]) = (-300, -100, -25, 25, 100, 300);
    }

    function test_FullWeekendCycleOnDeployedContracts() public {
        // 1. Borrow while the session is open and the live feed is priced.
        uint256 openTs = cal.nextOpen(block.timestamp);
        if (!cal.isOpen(block.timestamp)) vm.warp(openTs + 1 hours);
        (, int256 livePrice,,,) = feed.latestRoundData();
        assertGt(livePrice, 0, "relayer has mirrored a price");

        vm.startPrank(borrower);
        pool.deposit(5e18);
        uint256 loan = pool.maxBorrow(borrower) / 2;
        pool.borrow(loan);
        vm.stopPrank();
        assertGt(loan, 0);

        // 2. Friday 20:00 ET: the relayer posts one last round, then the feed stops.
        uint256 saturday = _nextClosure();
        uint256 close = cal.lastClose(saturday);
        vm.warp(close - 1 minutes);
        vm.prank(relayer);
        feed.mirror(livePrice, close - 1 minutes, close - 1 minutes);
        vm.warp(saturday);
        assertTrue(oracle.isFeedFrozen(), "feed frozen over the weekend");
        vm.expectRevert(GapGuardedLendingPool.PricingPaused.selector);
        pool.riskPrice();

        // 3. A market opens and becomes the oracle's source.
        vm.prank(maker);
        uint256 id = gm.createMarket(AggregatorV3Interface(address(feed)), edges(), 20e18, 200);
        oracle.setActiveMarket(id);
        (,, , bool implied) = oracle.priceBand();
        assertTrue(implied, "oracle now publishes a market price");

        // 3b. The pool insures its own loan book against a crash, paying the underwriter a fee.
        (uint256 cover, uint256 premium) = pool.hedge(id);
        assertGt(cover, 0, "pool bought crash cover");
        assertLe(premium, pool.totalDebt() / 100, "premium within 1% of loans");

        // 4. Traders price a gap down; borrowing power shrinks, the position stays safe.
        vm.prank(bear);
        gm.buy(id, 1, 40e18, type(uint256).max);
        (int256 low, int256 mid, int256 high,) = oracle.priceBand();
        assertLt(mid, livePrice, "implied price below Friday close");
        assertLt(low, mid);
        assertGt(high, mid);
        assertFalse(pool.isLiquidatable(borrower), "a modest gap does not liquidate a half-used loan");

        // 5. The session reopens; the relayer posts the first round and anyone can settle.
        GapMarket.Market memory m = gm.getMarket(id);
        vm.warp(uint256(m.reopenTs) + 1 minutes);
        int256 reopenPrice = livePrice * 96 / 100; // reopens 4% down, into the crash range
        vm.prank(relayer);
        uint80 round = feed.mirror(reopenPrice, uint256(m.reopenTs) + 30, uint256(m.reopenTs) + 30);
        gm.resolve(id, round);

        m = gm.getMarket(id);
        assertTrue(m.resolved);
        assertEq(m.winner, 0, "-4% lands in the -3%-or-worse range");

        // 6. The pool's cover pays out, the maker sweeps the rest plus fees, and the oracle is live again.
        uint256 poolBefore = usdg.balanceOf(address(pool));
        uint256 payout = pool.collectHedge(id);
        assertEq(payout, cover / 1e12, "each winning share pays 1 USDG into the pool");
        assertEq(usdg.balanceOf(address(pool)) - poolBefore, payout);
        vm.startPrank(maker);
        gm.withdrawResidual(id);
        assertGt(gm.claimFees(id), 0, "underwriter earned fees from the pool and the bear");
        vm.stopPrank();
        (,,, implied) = oracle.priceBand();
        assertFalse(implied, "back to the live feed once the session reopens");
    }

    /// @dev First instant after the next session close.
    function _nextClosure() internal view returns (uint256) {
        uint256 ts = block.timestamp;
        for (uint256 i; i < 14 days; i += 1 hours) {
            if (!cal.isOpen(ts + i)) return ts + i + 12 hours;
        }
        revert("no closure ahead");
    }
}
