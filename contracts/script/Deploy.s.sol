// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {ILmsrMath} from "../src/ILmsrMath.sol";
import {LmsrMathSol} from "../src/LmsrMathSol.sol";
import {MarketCalendar} from "../src/MarketCalendar.sol";
import {MirroredFeed} from "../src/MirroredFeed.sol";
import {GapMarket} from "../src/GapMarket.sol";
import {ImpliedPriceOracle} from "../src/ImpliedPriceOracle.sol";
import {GapGuardedLendingPool} from "../src/GapGuardedLendingPool.sol";

/// @notice Deploys Gapline v3 to Robinhood Chain testnet: one calendar and one GapMarket priced by the Stylus
/// LmsrMath program, and a mirrored feed, oracle and lending pool per stock.
///   LMSR_MATH=<stylus address> forge script script/Deploy.s.sol --rpc-url robinhood_testnet --broadcast ...
/// Without LMSR_MATH it deploys the Solidity reference LmsrMathSol instead.
contract Deploy is Script {
    /// Paxos USDG on Robinhood Chain testnet (docs.paxos.com/guides/stablecoin/usdg/testnet).
    address constant TESTNET_USDG = 0x7E955252E15c84f5768B83c41a71F9eba181802F;

    struct Stock {
        string symbol;
        /// Testnet stock token dispensed by faucet.testnet.chain.robinhood.com.
        address token;
        /// Chainlink feed on Robinhood Chain mainnet that the relayer mirrors.
        address mainnetFeed;
    }

    function stocks() internal pure returns (Stock[] memory list) {
        list = new Stock[](2);
        list[0] = Stock("TSLA", 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E, 0x4A1166a659A55625345e9515b32adECea5547C38);
        list[1] = Stock("AMZN", 0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02, 0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C);
    }

    function run() external {
        address usdg = vm.envOr("USDG", TESTNET_USDG);
        // Minimum LMSR depth for a market to drive an oracle; sized for faucet USDG on testnet.
        uint256 minLiquidity = vm.envOr("MIN_LIQUIDITY", uint256(10e18));
        // Trading fee paid to each market's underwriter (its creator), in basis points.
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(100));
        address mathAddress = vm.envOr("LMSR_MATH", address(0));

        vm.startBroadcast();
        address deployer = msg.sender;
        address relayer = vm.envOr("RELAYER", deployer);

        ILmsrMath math = mathAddress == address(0) ? ILmsrMath(address(new LmsrMathSol())) : ILmsrMath(mathAddress);
        MarketCalendar calendar = new MarketCalendar(deployer);
        _setHolidays(calendar);
        GapMarket gapMarket = new GapMarket(IERC20(usdg), calendar, math, feeBps);

        Stock[] memory list = stocks();
        address[] memory feeds = new address[](list.length);
        address[] memory oracles = new address[](list.length);
        address[] memory pools = new address[](list.length);
        for (uint256 i; i < list.length; ++i) {
            MirroredFeed feed =
                new MirroredFeed(relayer, 8, string.concat("RH", list[i].symbol, " / USD (mainnet mirror)"));
            ImpliedPriceOracle oracle = new ImpliedPriceOracle(
                AggregatorV3Interface(address(feed)),
                gapMarket,
                1 days, // stale during market hours after a day without updates
                minLiquidity,
                2 // band = mean +/- 2 standard deviations
            );
            GapGuardedLendingPool pool = new GapGuardedLendingPool(IERC20(list[i].token), IERC20(usdg), oracle);
            (feeds[i], oracles[i], pools[i]) = (address(feed), address(oracle), address(pool));
        }
        vm.stopBroadcast();

        string memory stocksJson = "stocks";
        string memory stocksOut;
        for (uint256 i; i < list.length; ++i) {
            string memory key = list[i].symbol;
            vm.serializeAddress(key, "token", list[i].token);
            vm.serializeAddress(key, "mainnetFeed", list[i].mainnetFeed);
            vm.serializeAddress(key, "feed", feeds[i]);
            vm.serializeAddress(key, "oracle", oracles[i]);
            string memory stockJson = vm.serializeAddress(key, "lendingPool", pools[i]);
            stocksOut = vm.serializeString(stocksJson, key, stockJson);
        }

        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "usdg", usdg);
        vm.serializeAddress(json, "calendar", address(calendar));
        vm.serializeAddress(json, "lmsrMath", address(math));
        vm.serializeBool(json, "lmsrMathIsStylus", mathAddress != address(0));
        vm.serializeAddress(json, "gapMarket", address(gapMarket));
        string memory out = vm.serializeString(json, "stocks", stocksOut);
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
