// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {MarketCalendar} from "../src/MarketCalendar.sol";
import {MirroredFeed} from "../src/MirroredFeed.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {ImpliedPriceOracle} from "../src/ImpliedPriceOracle.sol";
import {GapGuardedLendingPool} from "../src/GapGuardedLendingPool.sol";

/// @notice Deploys Gapline to Robinhood Chain testnet.
/// forge script script/Deploy.s.sol --rpc-url robinhood_testnet --account deployer --broadcast
contract Deploy is Script {
    /// Paxos USDG on Robinhood Chain testnet (docs.paxos.com/guides/stablecoin/usdg/testnet).
    address constant TESTNET_USDG = 0x7E955252E15c84f5768B83c41a71F9eba181802F;
    /// Robinhood's testnet TSLA stock token (dispensed by faucet.testnet.chain.robinhood.com).
    address constant TESTNET_TSLA = 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E;

    function run() external {
        address usdg = vm.envOr("USDG", TESTNET_USDG);
        address stock = vm.envOr("STOCK", TESTNET_TSLA);
        // Minimum LMSR depth for a market to drive the oracle; sized for faucet USDG on testnet.
        uint256 minLiquidity = vm.envOr("MIN_LIQUIDITY", uint256(10e18));
        // Trading fee paid to each market's underwriter (its creator), in basis points.
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(100));

        vm.startBroadcast();
        address deployer = msg.sender;
        address relayer = vm.envOr("RELAYER", deployer);

        MarketCalendar calendar = new MarketCalendar(deployer);
        _setHolidays(calendar);

        MirroredFeed feed = new MirroredFeed(relayer, 8, "RHTSLA / USD (mainnet mirror)");
        GapMarket gapMarket = new GapMarket(IERC20(usdg), calendar, feeBps);
        ImpliedPriceOracle oracle = new ImpliedPriceOracle(
            AggregatorV3Interface(address(feed)),
            gapMarket,
            1 days, // stale during market hours after a day without updates
            minLiquidity,
            2 // band = mean +/- 2 standard deviations
        );
        GapGuardedLendingPool pool = new GapGuardedLendingPool(IERC20(stock), IERC20(usdg), oracle);
        vm.stopBroadcast();

        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "usdg", usdg);
        vm.serializeAddress(json, "stock", stock);
        vm.serializeAddress(json, "calendar", address(calendar));
        vm.serializeAddress(json, "feed", address(feed));
        vm.serializeAddress(json, "gapMarket", address(gapMarket));
        vm.serializeAddress(json, "oracle", address(oracle));
        string memory out = vm.serializeAddress(json, "lendingPool", address(pool));
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        console.log("Deployed. Addresses written to deployments/%s.json", block.chainid);
    }

    /// NYSE full-day closures from nyse.com/markets/hours-calendars (checked 2026-09-22).
    function _setHolidays(MarketCalendar c) internal {
        uint16[3][12] memory days_ = [
            [uint16(2026), 11, 26], // Thanksgiving
            [uint16(2026), 12, 25], // Christmas
            [uint16(2027), 1, 1], // New Year's Day
            [uint16(2027), 1, 18], // Martin Luther King, Jr. Day
            [uint16(2027), 2, 15], // Washington's Birthday
            [uint16(2027), 3, 26], // Good Friday
            [uint16(2027), 5, 31], // Memorial Day
            [uint16(2027), 6, 18], // Juneteenth (observed)
            [uint16(2027), 7, 5], // Independence Day (observed)
            [uint16(2027), 9, 6], // Labor Day
            [uint16(2027), 11, 25], // Thanksgiving
            [uint16(2027), 12, 24] // Christmas (observed)
        ];
        for (uint256 i; i < days_.length; ++i) {
            c.setHoliday(days_[i][0], days_[i][1], days_[i][2], true);
        }
    }
}
