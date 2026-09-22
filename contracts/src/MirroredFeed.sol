// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title MirroredFeed
/// @notice Testnet copy of a mainnet Chainlink feed. Chainlink publishes Robinhood stock feeds on
/// mainnet only, so a relayer copies each mainnet round here with its original timestamps. Unlike
/// Chainlink's MockV3Aggregator, only the owner (the relayer) can write, so public-testnet users
/// cannot push fake prices into markets that settle against it.
contract MirroredFeed is AggregatorV3Interface, Ownable {
    struct Round {
        int256 answer;
        uint64 startedAt;
        uint64 updatedAt;
    }

    uint8 public immutable decimals;
    string public description;
    uint80 public latestRound;
    mapping(uint80 => Round) internal rounds;

    event RoundMirrored(uint80 indexed roundId, int256 answer, uint256 updatedAt);

    error RoundNotFound();
    error NonMonotonic();

    constructor(address owner_, uint8 decimals_, string memory description_) Ownable(owner_) {
        decimals = decimals_;
        description = description_;
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    /// @notice Append the next round. Timestamps must not go backwards.
    function mirror(int256 answer, uint256 startedAt, uint256 updatedAt) external onlyOwner returns (uint80 roundId) {
        if (latestRound > 0 && updatedAt < rounds[latestRound].updatedAt) revert NonMonotonic();
        roundId = ++latestRound;
        rounds[roundId] = Round(answer, uint64(startedAt), uint64(updatedAt));
        emit RoundMirrored(roundId, answer, updatedAt);
    }

    function getRoundData(uint80 roundId) public view returns (uint80, int256, uint256, uint256, uint80) {
        Round memory r = rounds[roundId];
        if (r.updatedAt == 0) revert RoundNotFound();
        return (roundId, r.answer, r.startedAt, r.updatedAt, roundId);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return getRoundData(latestRound);
    }
}
