// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {MarketCalendar} from "./MarketCalendar.sol";
import {GapMarket} from "./GapMarket.sol";

/// @title ImpliedPriceOracle
/// @notice Drop-in AggregatorV3Interface for a tokenized-equity feed. While the underlying market
/// trades and the feed is fresh it passes the Chainlink price through. While the feed is frozen
/// (weekends, holidays, corporate-action pauses) it reports the price implied by the deepest
/// GapMarket for the current closure, with a confidence band consumers can use conservatively.
contract ImpliedPriceOracle is AggregatorV3Interface {
    int256 private constant BPS = 10_000;

    AggregatorV3Interface public immutable feed;
    GapMarket public immutable gapMarket;
    MarketCalendar public immutable calendar;
    /// @notice A feed older than this during market hours is treated as frozen.
    uint256 public immutable maxStaleness;
    /// @notice Minimum LMSR liquidity for a market to be trusted as a price source.
    uint256 public immutable minLiquidity;
    /// @notice Band half-width in standard deviations of the implied move.
    uint256 public immutable bandSigmas;

    uint256 public activeMarketId;
    bool public hasActiveMarket;

    event ActiveMarketSet(uint256 indexed marketId, uint256 liquidity);

    error WrongFeed();
    error NotCurrentClosure();
    error MarketResolved();
    error TooShallow();

    constructor(
        AggregatorV3Interface feed_,
        GapMarket gapMarket_,
        uint256 maxStaleness_,
        uint256 minLiquidity_,
        uint256 bandSigmas_
    ) {
        feed = feed_;
        gapMarket = gapMarket_;
        calendar = gapMarket_.calendar();
        maxStaleness = maxStaleness_;
        minLiquidity = minLiquidity_;
        bandSigmas = bandSigmas_;
    }

    /// @notice Point the oracle at a market for the current closure. Anyone may call; a market can
    /// only replace the current one if the current one is outdated or the new one is deeper.
    function setActiveMarket(uint256 marketId) external {
        GapMarket.Market memory m = gapMarket.getMarket(marketId);
        if (address(m.feed) != address(feed)) revert WrongFeed();
        if (m.resolved) revert MarketResolved();
        if (block.timestamp >= m.reopenTs) revert NotCurrentClosure();
        if (uint256(m.liquidity) < minLiquidity) revert TooShallow();
        if (hasActiveMarket && _isCurrent(activeMarketId)) {
            if (m.liquidity <= gapMarket.getMarket(activeMarketId).liquidity) revert TooShallow();
        }
        activeMarketId = marketId;
        hasActiveMarket = true;
        emit ActiveMarketSet(marketId, uint256(m.liquidity));
    }

    /// @notice True when the oracle is reporting a market-implied price instead of the feed.
    function isImplied() public view returns (bool) {
        return isFeedFrozen() && hasActiveMarket && _isCurrent(activeMarketId);
    }

    /// @notice The feed is frozen when the session is closed or it has not updated recently.
    function isFeedFrozen() public view returns (bool) {
        (,,, uint256 updatedAt,) = feed.latestRoundData();
        bool stale = block.timestamp > updatedAt && block.timestamp - updatedAt > maxStaleness;
        return !calendar.isOpen(block.timestamp) || stale;
    }

    /// @notice Conservative price range. Equal bounds when the live feed is used.
    function priceBand() public view returns (int256 low, int256 mid, int256 high, bool implied) {
        implied = isImplied();
        if (!implied) {
            (, mid,,,) = feed.latestRoundData();
            return (mid, mid, mid, false);
        }
        GapMarket.Market memory m = gapMarket.getMarket(activeMarketId);
        (int256 meanBps, uint256 stdevBps) = gapMarket.impliedMove(activeMarketId);
        int256 spread = int256(stdevBps * bandSigmas);
        mid = m.refPrice * (BPS + meanBps) / BPS;
        low = m.refPrice * (BPS + meanBps - spread) / BPS;
        high = m.refPrice * (BPS + meanBps + spread) / BPS;
        if (low < 0) low = 0;
    }

    // ------------------------------------------------------------------ AggregatorV3Interface

    function decimals() external view returns (uint8) {
        return feed.decimals();
    }

    function description() external view returns (string memory) {
        return string.concat(feed.description(), " (gap-implied)");
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 roundId) external view returns (uint80, int256, uint256, uint256, uint80) {
        return feed.getRoundData(roundId);
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = feed.latestRoundData();
        if (isImplied()) {
            (, answer,,) = priceBand();
            // The implied price is live market data, so it is fresh as of this block.
            updatedAt = block.timestamp;
        }
    }

    function _isCurrent(uint256 marketId) internal view returns (bool) {
        GapMarket.Market memory m = gapMarket.getMarket(marketId);
        return !m.resolved && block.timestamp < m.reopenTs;
    }
}
