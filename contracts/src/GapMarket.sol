// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {SD59x18, sd, exp, ln} from "@prb/math/SD59x18.sol";

import {MarketCalendar} from "./MarketCalendar.sol";

/// @title GapMarket
/// @notice Prices where a tokenized stock reopens while its Chainlink feed is frozen.
/// For each closure, a market splits the reopening move into ranges of basis points. Traders
/// buy and sell range shares from an LMSR market maker; each winning share redeems 1 unit of
/// collateral (USDG). Settlement is permissionless: the first feed round published after the
/// session reopens decides the winning range. Every trade pays a fee to the market's creator, the
/// underwriter who seeded the market maker, so funding a market has positive expected value.
contract GapMarket is ERC1155Supply, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 public constant MIN_OUTCOMES = 2;
    uint256 public constant MAX_OUTCOMES = 16;
    int256 private constant BPS = 10_000;
    /// @dev A settlement round must land within this window after the reopen.
    uint256 public constant MAX_SETTLE_DELAY = 6 hours;
    uint256 public constant MAX_FEE_BPS = 500;

    IERC20 public immutable collateral;
    MarketCalendar public immutable calendar;
    /// @dev Converts 18-decimal share/cost units into collateral units.
    uint256 private immutable scale;
    /// @notice Trading fee in basis points, charged on the collateral amount of every buy and sell.
    uint256 public immutable feeBps;

    struct Market {
        AggregatorV3Interface feed;
        address creator;
        uint64 closeTs;
        uint64 reopenTs;
        int256 refPrice;
        /// @dev LMSR liquidity parameter b, 18 decimals.
        int256 liquidity;
        int256 tailWidthBps;
        int256[] boundariesBps;
        int256[] shares;
        uint256 collateralHeld;
        /// @dev Fees owed to the creator; kept apart from collateralHeld, which backs winning shares.
        uint256 feesAccrued;
        bool resolved;
        uint8 winner;
        int256 settlePrice;
    }

    Market[] internal markets;

    event MarketCreated(
        uint256 indexed marketId, address indexed feed, int256 refPrice, uint64 closeTs, uint64 reopenTs, int256[] boundariesBps
    );
    event Traded(
        uint256 indexed marketId, address indexed trader, uint8 outcome, int256 shareDelta, uint256 collateralAmount, uint256 fee
    );
    event FeesClaimed(uint256 indexed marketId, uint256 amount);
    event Resolved(uint256 indexed marketId, uint80 roundId, int256 settlePrice, int256 moveBps, uint8 winner);
    event Redeemed(uint256 indexed marketId, address indexed holder, uint256 shares, uint256 payout);
    event ResidualWithdrawn(uint256 indexed marketId, uint256 amount);

    error MarketIsOpen();
    error BadBoundaries();
    error BadLiquidity();
    error StaleReference();
    error BadOutcome();
    error TradingClosed();
    error Slippage();
    error AlreadyResolved();
    error NotResolved();
    error TooEarly();
    error NotFirstRoundAfterReopen();
    error BadPrice();
    error NotCreator();
    error FeeTooHigh();

    constructor(IERC20 collateral_, MarketCalendar calendar_, uint256 feeBps_) ERC1155("") {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        collateral = collateral_;
        calendar = calendar_;
        feeBps = feeBps_;
        scale = 10 ** (18 - IERC20Metadata(address(collateral_)).decimals());
    }

    // ------------------------------------------------------------------ lifecycle

    /// @notice Open a market for the current closure of `feed`. The caller seeds the market maker
    /// with its worst-case loss, b * ln(n), in collateral.
    /// @param boundariesBps Ascending range edges; n-1 edges give n ranges.
    /// @param liquidity LMSR b in 18-decimal share units; larger b means deeper, slower-moving prices.
    /// @param tailWidthBps Representative distance beyond the outer edges, used for the implied price.
    function createMarket(
        AggregatorV3Interface feed,
        int256[] calldata boundariesBps,
        uint256 liquidity,
        uint256 tailWidthBps
    ) external nonReentrant returns (uint256 marketId) {
        if (calendar.isOpen(block.timestamp)) revert MarketIsOpen();
        uint256 n = boundariesBps.length + 1;
        if (n < MIN_OUTCOMES || n > MAX_OUTCOMES) revert BadBoundaries();
        for (uint256 i = 1; i < boundariesBps.length; ++i) {
            if (boundariesBps[i] <= boundariesBps[i - 1]) revert BadBoundaries();
        }
        if (liquidity == 0 || liquidity > 1e30) revert BadLiquidity();

        uint256 closeTs = calendar.lastClose(block.timestamp);
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0) revert BadPrice();
        if (updatedAt > closeTs || updatedAt + 3 days < closeTs) revert StaleReference();

        marketId = markets.length;
        Market storage m = markets.push();
        m.feed = feed;
        m.creator = msg.sender;
        m.closeTs = closeTs.toUint64();
        m.reopenTs = calendar.nextOpen(block.timestamp).toUint64();
        m.refPrice = answer;
        m.liquidity = liquidity.toInt256();
        m.tailWidthBps = tailWidthBps.toInt256();
        m.boundariesBps = boundariesBps;
        m.shares = new int256[](n);

        // Worst-case subsidy of an LMSR maker starting from zero shares: b * ln(n).
        uint256 subsidy = _toCollateralUp((sd(m.liquidity).mul(ln(sd(int256(n) * 1e18)))).unwrap().toUint256());
        m.collateralHeld = subsidy;
        collateral.safeTransferFrom(msg.sender, address(this), subsidy);

        emit MarketCreated(marketId, address(feed), answer, m.closeTs, m.reopenTs, boundariesBps);
    }

    /// @notice Buy `shares` (18 decimals) of range `outcome`, paying at most `maxCost` collateral, fee included.
    function buy(uint256 marketId, uint8 outcome, uint256 shares, uint256 maxCost)
        external
        nonReentrant
        returns (uint256 cost)
    {
        Market storage m = _tradable(marketId, outcome);
        uint256 base = _toCollateralUp(_costDelta(m, outcome, shares.toInt256()).toUint256());
        uint256 fee = _fee(base);
        cost = base + fee;
        if (cost > maxCost) revert Slippage();
        m.shares[outcome] += shares.toInt256();
        m.collateralHeld += base;
        m.feesAccrued += fee;
        collateral.safeTransferFrom(msg.sender, address(this), cost);
        _mint(msg.sender, tokenId(marketId, outcome), shares, "");
        emit Traded(marketId, msg.sender, outcome, shares.toInt256(), cost, fee);
    }

    /// @notice Sell `shares` of range `outcome` back to the market maker for at least `minReturn`, fee deducted.
    function sell(uint256 marketId, uint8 outcome, uint256 shares, uint256 minReturn)
        external
        nonReentrant
        returns (uint256 proceeds)
    {
        Market storage m = _tradable(marketId, outcome);
        uint256 gross = _toCollateralDown((-_costDelta(m, outcome, -shares.toInt256())).toUint256());
        uint256 fee = _fee(gross);
        proceeds = gross - fee;
        if (proceeds < minReturn) revert Slippage();
        _burn(msg.sender, tokenId(marketId, outcome), shares);
        m.shares[outcome] -= shares.toInt256();
        m.collateralHeld -= gross;
        m.feesAccrued += fee;
        collateral.safeTransfer(msg.sender, proceeds);
        emit Traded(marketId, msg.sender, outcome, -shares.toInt256(), proceeds, fee);
    }

    /// @notice Settle using the first feed round published at or after the reopen.
    /// Anyone can call this; the round is checked against its predecessor so it cannot be cherry-picked.
    function resolve(uint256 marketId, uint80 roundId) external {
        Market storage m = markets[marketId];
        if (m.resolved) revert AlreadyResolved();
        if (block.timestamp < m.reopenTs) revert TooEarly();

        (, int256 answer,, uint256 updatedAt,) = m.feed.getRoundData(roundId);
        if (answer <= 0) revert BadPrice();
        if (updatedAt < m.reopenTs || updatedAt > m.reopenTs + MAX_SETTLE_DELAY) {
            revert NotFirstRoundAfterReopen();
        }
        // Rounds restart at 1 when a feed's aggregator phase changes; the delay window above
        // still bounds the choice in that case.
        if (uint64(roundId) > 1) {
            (,,, uint256 prevUpdatedAt,) = m.feed.getRoundData(roundId - 1);
            if (prevUpdatedAt >= m.reopenTs) revert NotFirstRoundAfterReopen();
        }

        int256 moveBps = (answer - m.refPrice) * BPS / m.refPrice;
        uint8 winner;
        for (uint256 i; i < m.boundariesBps.length; ++i) {
            if (moveBps >= m.boundariesBps[i]) winner = uint8(i + 1);
        }
        m.resolved = true;
        m.winner = winner;
        m.settlePrice = answer;
        emit Resolved(marketId, roundId, answer, moveBps, winner);
    }

    /// @notice Burn all winning shares held by the caller for 1 collateral unit each.
    function redeem(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = markets[marketId];
        if (!m.resolved) revert NotResolved();
        uint256 id = tokenId(marketId, m.winner);
        uint256 shares = balanceOf(msg.sender, id);
        _burn(msg.sender, id, shares);
        payout = _toCollateralDown(shares);
        m.collateralHeld -= payout;
        collateral.safeTransfer(msg.sender, payout);
        emit Redeemed(marketId, msg.sender, shares, payout);
    }

    /// @notice The creator can claim trading fees at any time; they never back winning shares.
    function claimFees(uint256 marketId) external nonReentrant returns (uint256 amount) {
        Market storage m = markets[marketId];
        if (msg.sender != m.creator) revert NotCreator();
        amount = m.feesAccrued;
        m.feesAccrued = 0;
        collateral.safeTransfer(msg.sender, amount);
        emit FeesClaimed(marketId, amount);
    }

    /// @notice After settlement the market maker's creator takes back whatever is not owed to winners.
    function withdrawResidual(uint256 marketId) external nonReentrant returns (uint256 amount) {
        Market storage m = markets[marketId];
        if (msg.sender != m.creator) revert NotCreator();
        if (!m.resolved) revert NotResolved();
        uint256 owed = _toCollateralUp(totalSupply(tokenId(marketId, m.winner)));
        amount = m.collateralHeld > owed ? m.collateralHeld - owed : 0;
        m.collateralHeld -= amount;
        collateral.safeTransfer(msg.sender, amount);
        emit ResidualWithdrawn(marketId, amount);
    }

    // ------------------------------------------------------------------ views

    function tokenId(uint256 marketId, uint8 outcome) public pure returns (uint256) {
        return (marketId << 8) | outcome;
    }

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /// @notice All-in cost of buying `shares`, fee included.
    function quoteBuy(uint256 marketId, uint8 outcome, uint256 shares) external view returns (uint256) {
        uint256 base = _toCollateralUp(_costDelta(markets[marketId], outcome, shares.toInt256()).toUint256());
        return base + _fee(base);
    }

    /// @notice Net proceeds of selling `shares`, fee deducted.
    function quoteSell(uint256 marketId, uint8 outcome, uint256 shares) external view returns (uint256) {
        uint256 gross = _toCollateralDown((-_costDelta(markets[marketId], outcome, -shares.toInt256())).toUint256());
        return gross - _fee(gross);
    }

    /// @notice LMSR prices, i.e. the market's probability for each range (18 decimals, sums to 1e18).
    function prices(uint256 marketId) public view returns (uint256[] memory p) {
        Market storage m = markets[marketId];
        uint256 n = m.shares.length;
        (SD59x18[] memory w, SD59x18 total) = _weights(m, m.shares);
        p = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            p[i] = w[i].div(total).unwrap().toUint256();
        }
    }

    /// @notice Probability-weighted reopening move and its spread, in basis points.
    function impliedMove(uint256 marketId) public view returns (int256 meanBps, uint256 stdevBps) {
        Market storage m = markets[marketId];
        uint256[] memory p = prices(marketId);
        int256 secondMoment;
        for (uint256 i; i < p.length; ++i) {
            int256 x = _representativeBps(m, i);
            int256 pi = int256(p[i]);
            meanBps += pi * x / 1e18;
            secondMoment += pi * x * x / 1e18;
        }
        int256 variance = secondMoment - meanBps * meanBps;
        stdevBps = variance > 0 ? Math.sqrt(uint256(variance)) : 0;
    }

    // ------------------------------------------------------------------ internals

    function _tradable(uint256 marketId, uint8 outcome) internal view returns (Market storage m) {
        m = markets[marketId];
        if (outcome >= m.shares.length) revert BadOutcome();
        if (m.resolved || block.timestamp >= m.reopenTs) revert TradingClosed();
    }

    /// @dev C(q + delta * e_outcome) - C(q), 18 decimals. Positive for buys, negative for sells.
    function _costDelta(Market storage m, uint8 outcome, int256 delta) internal view returns (int256) {
        if (outcome >= m.shares.length) revert BadOutcome();
        int256[] memory q = m.shares;
        int256 before = _cost(m, q);
        q[outcome] += delta;
        return _cost(m, q) - before;
    }

    /// @dev LMSR cost b * ln(sum exp(q_i / b)), computed as max + b * ln(sum exp((q_i - max) / b))
    /// so every exponent is <= 0 and cannot overflow.
    function _cost(Market storage m, int256[] memory q) internal view returns (int256) {
        (, SD59x18 total) = _weights(m, q);
        int256 qMax = _max(q);
        return qMax + sd(m.liquidity).mul(ln(total)).unwrap();
    }

    function _weights(Market storage m, int256[] memory q)
        internal
        view
        returns (SD59x18[] memory w, SD59x18 total)
    {
        int256 qMax = _max(q);
        SD59x18 b = sd(m.liquidity);
        w = new SD59x18[](q.length);
        for (uint256 i; i < q.length; ++i) {
            w[i] = exp(sd(q[i] - qMax).div(b));
            total = total.add(w[i]);
        }
    }

    /// @dev Midpoint of range i; the open-ended tails sit tailWidthBps beyond the outer edges.
    function _representativeBps(Market storage m, uint256 i) internal view returns (int256) {
        int256[] storage e = m.boundariesBps;
        if (i == 0) return e[0] - m.tailWidthBps;
        if (i == e.length) return e[e.length - 1] + m.tailWidthBps;
        return (e[i - 1] + e[i]) / 2;
    }

    function _max(int256[] memory q) internal pure returns (int256 r) {
        r = q[0];
        for (uint256 i = 1; i < q.length; ++i) {
            if (q[i] > r) r = q[i];
        }
    }

    function _fee(uint256 amount) internal view returns (uint256) {
        return Math.mulDiv(amount, feeBps, 10_000, Math.Rounding.Ceil);
    }

    function _toCollateralUp(uint256 amount18) internal view returns (uint256) {
        return Math.ceilDiv(amount18, scale);
    }

    function _toCollateralDown(uint256 amount18) internal view returns (uint256) {
        return amount18 / scale;
    }
}
