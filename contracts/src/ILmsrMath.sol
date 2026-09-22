// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ILmsrMath
/// @notice LMSR pricing used by GapMarket. Two implementations share this interface: the Arbitrum Stylus contract
/// in `stylus/lmsr-math` (Rust, deployed on Robinhood Chain) and `LmsrMathSol` (Solidity reference). Both port
/// PRBMath's fixed-point exp/ln exactly, so they return identical results.
/// All values are 18-decimal fixed point; `liquidity` is the LMSR parameter b.
interface ILmsrMath {
    /// @notice C(q) = b * ln(sum exp(q_i / b)).
    function cost(int256 liquidity, int256[] calldata shares) external view returns (int256);

    /// @notice C(q + delta * e_outcome) - C(q): positive for buys, negative for sells.
    function costDelta(int256 liquidity, int256[] calldata shares, uint8 outcome, int256 delta)
        external
        view
        returns (int256);

    /// @notice Probability of each outcome, summing to ~1e18.
    function prices(int256 liquidity, int256[] calldata shares) external view returns (uint256[] memory);
}
