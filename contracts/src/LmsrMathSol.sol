// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SD59x18, sd, exp, ln} from "@prb/math/SD59x18.sol";

import {ILmsrMath} from "./ILmsrMath.sol";

/// @title LmsrMathSol
/// @notice Solidity reference for the Stylus LmsrMath contract, built on PRBMath. Used by the Foundry tests and fork
/// rehearsals (anvil cannot execute Stylus WASM) and as the parity baseline for the on-chain Stylus deployment.
/// Stateless, so it can also be etched over the Stylus address on a fork.
contract LmsrMathSol is ILmsrMath {
    error BadOutcome();

    function cost(int256 liquidity, int256[] calldata shares) external pure returns (int256) {
        return _cost(liquidity, shares);
    }

    function costDelta(int256 liquidity, int256[] calldata shares, uint8 outcome, int256 delta)
        external
        pure
        returns (int256)
    {
        if (outcome >= shares.length) revert BadOutcome();
        int256[] memory moved = shares;
        int256 before = _cost(liquidity, moved);
        moved[outcome] += delta;
        return _cost(liquidity, moved) - before;
    }

    function prices(int256 liquidity, int256[] calldata shares) external pure returns (uint256[] memory p) {
        (SD59x18[] memory w, SD59x18 total) = _weights(liquidity, shares);
        p = new uint256[](w.length);
        for (uint256 i; i < w.length; ++i) {
            p[i] = uint256(w[i].div(total).unwrap());
        }
    }

    /// @dev max + b * ln(sum exp((q_i - max) / b)): every exponent is <= 0, so nothing overflows.
    function _cost(int256 liquidity, int256[] memory q) internal pure returns (int256) {
        (, SD59x18 total) = _weights(liquidity, q);
        return _max(q) + sd(liquidity).mul(ln(total)).unwrap();
    }

    function _weights(int256 liquidity, int256[] memory q) internal pure returns (SD59x18[] memory w, SD59x18 total) {
        int256 qMax = _max(q);
        SD59x18 b = sd(liquidity);
        w = new SD59x18[](q.length);
        for (uint256 i; i < q.length; ++i) {
            w[i] = exp(sd(q[i] - qMax).div(b));
            total = total.add(w[i]);
        }
    }

    function _max(int256[] memory q) internal pure returns (int256 r) {
        r = q[0];
        for (uint256 i = 1; i < q.length; ++i) {
            if (q[i] > r) r = q[i];
        }
    }
}
