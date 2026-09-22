// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {GapMarket} from "./GapMarket.sol";
import {ImpliedPriceOracle} from "./ImpliedPriceOracle.sol";

/// @title GapGuardedLendingPool
/// @notice Minimal demo: borrow USDG against a tokenized stock, priced through ImpliedPriceOracle.
/// While the stock's market is closed the pool reads the gap-implied confidence band and uses it
/// asymmetrically: new risk (borrow, withdraw) is valued at the band's low end, while liquidation
/// requires the position to be unhealthy even at the band's high end. That blocks both over-borrowing
/// on thin weekend prints and liquidations triggered by them. If the feed is frozen with no gap
/// market to price it, new risk and liquidations both pause until the feed resumes.
/// Each weekend the pool also buys gap-down cover on the oracle's market, sized to its outstanding
/// debt, so the protocol that carries the gap risk is the one that pays to insure it.
contract GapGuardedLendingPool is ReentrancyGuard, ERC1155Holder {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_LTV_BPS = 5_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 7_000;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    /// @notice Cover bought each weekend pays out this share of outstanding debt if the worst range wins.
    uint256 public constant HEDGE_COVER_BPS = 1_000;
    /// @notice Premium spent on that cover is capped at this share of outstanding debt.
    uint256 public constant HEDGE_BUDGET_BPS = 100;
    /// @dev Range bought as cover: outcome 0, the open-ended "worst gap down" range.
    uint8 private constant CRASH_RANGE = 0;
    uint256 private constant MAX_HALVINGS = 12;

    IERC20 public immutable stock;
    IERC20 public immutable usdg;
    ImpliedPriceOracle public immutable oracle;
    GapMarket public immutable gapMarket;
    /// @dev Converts stock amount * oracle price into USDG units.
    uint256 private immutable valueDivisor;

    mapping(address => uint256) public collateralOf;
    mapping(address => uint256) public debtOf;
    uint256 public totalDebt;
    /// @notice Crash-range shares bought per market, and the premium paid for them.
    mapping(uint256 marketId => uint256) public hedgeShares;
    mapping(uint256 marketId => uint256) public hedgePremium;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, address indexed payer, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 repaid, uint256 seized, int256 priceUsed);
    event Hedged(uint256 indexed marketId, uint256 shares, uint256 premium, uint256 debtCovered);
    event HedgeCollected(uint256 indexed marketId, uint256 payout);

    error PricingPaused();
    error ExceedsLtv();
    error Healthy();
    error InsufficientLiquidity();
    error NotActiveMarket();
    error AlreadyHedged();
    error NothingToHedge();

    constructor(IERC20 stock_, IERC20 usdg_, ImpliedPriceOracle oracle_) {
        stock = stock_;
        usdg = usdg_;
        oracle = oracle_;
        gapMarket = oracle_.gapMarket();
        uint256 stockDecimals = IERC20Metadata(address(stock_)).decimals();
        uint256 usdgDecimals = IERC20Metadata(address(usdg_)).decimals();
        valueDivisor = 10 ** (stockDecimals + oracle_.decimals() - usdgDecimals);
    }

    // ------------------------------------------------------------------ user actions

    function deposit(uint256 amount) external nonReentrant {
        collateralOf[msg.sender] += amount;
        stock.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        collateralOf[msg.sender] -= amount;
        _requireWithinLtv(msg.sender);
        stock.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (usdg.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        debtOf[msg.sender] += amount;
        totalDebt += amount;
        _requireWithinLtv(msg.sender);
        usdg.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    function repay(address user, uint256 amount) external nonReentrant {
        amount = Math.min(amount, debtOf[user]);
        debtOf[user] -= amount;
        totalDebt -= amount;
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        emit Repaid(user, msg.sender, amount);
    }

    /// @notice Repay up to `repayAmount` of an unhealthy user's debt and seize collateral plus a bonus.
    function liquidate(address user, uint256 repayAmount) external nonReentrant returns (uint256 seized) {
        int256 price = liquidationPrice();
        if (_value(collateralOf[user], price) * LIQUIDATION_THRESHOLD_BPS / BPS >= debtOf[user]) revert Healthy();

        repayAmount = Math.min(repayAmount, debtOf[user]);
        seized = Math.mulDiv(repayAmount * (BPS + LIQUIDATION_BONUS_BPS) / BPS, valueDivisor, uint256(price));
        seized = Math.min(seized, collateralOf[user]);

        debtOf[user] -= repayAmount;
        totalDebt -= repayAmount;
        collateralOf[user] -= seized;
        usdg.safeTransferFrom(msg.sender, address(this), repayAmount);
        stock.safeTransfer(msg.sender, seized);
        emit Liquidated(user, msg.sender, repayAmount, seized, price);
    }

    // ------------------------------------------------------------------ gap cover

    /// @notice Buy this weekend's gap-down cover on the oracle's market. Anyone may call (a keeper does),
    /// once per market: shares paying HEDGE_COVER_BPS of debt in the worst range, for at most
    /// HEDGE_BUDGET_BPS of debt in premium, halving the size until the quote fits the budget.
    function hedge(uint256 marketId) external nonReentrant returns (uint256 shares, uint256 premium) {
        if (!oracle.isImplied() || oracle.activeMarketId() != marketId) revert NotActiveMarket();
        if (hedgeShares[marketId] != 0) revert AlreadyHedged();
        uint256 budget = totalDebt * HEDGE_BUDGET_BPS / BPS;
        if (budget == 0) revert NothingToHedge();

        // Winning shares redeem 1 USDG each, in 18-decimal share units.
        uint256 coverage = totalDebt * HEDGE_COVER_BPS / BPS;
        shares = coverage * (10 ** (18 - IERC20Metadata(address(usdg)).decimals()));
        premium = gapMarket.quoteBuy(marketId, CRASH_RANGE, shares);
        for (uint256 i; premium > budget && i < MAX_HALVINGS; ++i) {
            shares /= 2;
            premium = gapMarket.quoteBuy(marketId, CRASH_RANGE, shares);
        }
        if (premium > budget || shares == 0) revert NothingToHedge();

        hedgeShares[marketId] = shares;
        hedgePremium[marketId] = premium;
        usdg.forceApprove(address(gapMarket), premium);
        gapMarket.buy(marketId, CRASH_RANGE, shares, premium);
        emit Hedged(marketId, shares, premium, coverage);
    }

    /// @notice After settlement, redeem any winning cover back into the pool's reserves. Anyone may call.
    function collectHedge(uint256 marketId) external nonReentrant returns (uint256 payout) {
        payout = gapMarket.redeem(marketId);
        emit HedgeCollected(marketId, payout);
    }

    // ------------------------------------------------------------------ pricing

    /// @notice Price used to value collateral for new risk: the conservative low end.
    function riskPrice() public view returns (int256) {
        (int256 low,,, bool implied) = oracle.priceBand();
        if (!implied && oracle.isFeedFrozen()) revert PricingPaused();
        return low;
    }

    /// @notice Price used to decide liquidations: the optimistic high end.
    function liquidationPrice() public view returns (int256) {
        (,, int256 high, bool implied) = oracle.priceBand();
        if (!implied && oracle.isFeedFrozen()) revert PricingPaused();
        return high;
    }

    function maxBorrow(address user) external view returns (uint256) {
        uint256 limit = _value(collateralOf[user], riskPrice()) * MAX_LTV_BPS / BPS;
        return limit > debtOf[user] ? limit - debtOf[user] : 0;
    }

    function isLiquidatable(address user) external view returns (bool) {
        return _value(collateralOf[user], liquidationPrice()) * LIQUIDATION_THRESHOLD_BPS / BPS < debtOf[user];
    }

    function _requireWithinLtv(address user) internal view {
        if (debtOf[user] == 0) return;
        if (_value(collateralOf[user], riskPrice()) * MAX_LTV_BPS / BPS < debtOf[user]) revert ExceedsLtv();
    }

    function _value(uint256 amount, int256 price) internal view returns (uint256) {
        return Math.mulDiv(amount, uint256(price), valueDivisor);
    }
}
