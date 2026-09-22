// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {sd, exp, ln} from "@prb/math/SD59x18.sol";

import {LmsrMathSol} from "../src/LmsrMathSol.sol";

/// @notice Writes PRBMath-computed test vectors that the Stylus port must reproduce bit for bit.
/// forge script script/LmsrVectors.s.sol
contract LmsrVectors is Script {
    string constant DIR = "../stylus/lmsr-math/tests/vectors/";
    uint256 private seed = 0x6a70;

    function _rand(uint256 modulo) internal returns (uint256) {
        seed = uint256(keccak256(abi.encode(seed)));
        return seed % modulo;
    }

    function run() external {
        _expVectors();
        _lnVectors();
        _lmsrVectors();
    }

    function _expVectors() internal {
        string memory path = string.concat(DIR, "exp.csv");
        vm.writeFile(path, "");
        int256[8] memory fixedInputs = [int256(0), -1, -1e18, -41_446_531_673_892_822_322, -41_446_531_673_892_822_323, 1e18, 5e18, -693147180559945309];
        for (uint256 i; i < fixedInputs.length; ++i) {
            vm.writeLine(path, string.concat(vm.toString(fixedInputs[i]), ",", vm.toString(exp(sd(fixedInputs[i])).unwrap())));
        }
        for (uint256 i; i < 400; ++i) {
            int256 x = -int256(_rand(42e18)) + int256(_rand(3e18));
            vm.writeLine(path, string.concat(vm.toString(x), ",", vm.toString(exp(sd(x)).unwrap())));
        }
    }

    function _lnVectors() internal {
        string memory path = string.concat(DIR, "ln.csv");
        vm.writeFile(path, "");
        for (uint256 i; i < 400; ++i) {
            int256 x = i < 50 ? int256(_rand(1e18)) + 1 : int256(1e18 + _rand(20e18));
            vm.writeLine(path, string.concat(vm.toString(x), ",", vm.toString(ln(sd(x)).unwrap())));
        }
    }

    /// Each line: b;q0,q1,...;outcome;delta;cost;costDelta;p0,p1,...
    function _lmsrVectors() internal {
        LmsrMathSol math = new LmsrMathSol();
        string memory path = string.concat(DIR, "lmsr.csv");
        vm.writeFile(path, "");
        uint256[3] memory sizes = [uint256(2), 7, 16];
        int256[4] memory depths = [int256(10e18), 20e18, 1_000e18, 50_000e18];
        for (uint256 c; c < 240; ++c) {
            uint256 n = sizes[c % 3];
            int256 b = depths[(c / 3) % 4];
            int256[] memory q = new int256[](n);
            string memory qs;
            for (uint256 i; i < n; ++i) {
                q[i] = int256(_rand(uint256(b) * 6));
                qs = string.concat(qs, i == 0 ? "" : ",", vm.toString(q[i]));
            }
            uint8 outcome = uint8(_rand(n));
            int256 delta = int256(_rand(uint256(b) * 3)) - int256(_rand(uint256(q[outcome]) + 1));
            uint256[] memory p = math.prices(b, q);
            string memory ps;
            for (uint256 i; i < n; ++i) {
                ps = string.concat(ps, i == 0 ? "" : ",", vm.toString(p[i]));
            }
            vm.writeLine(
                path,
                string.concat(
                    vm.toString(b), ";", qs, ";", vm.toString(uint256(outcome)), ";", vm.toString(delta), ";",
                    vm.toString(math.cost(b, q)), ";", vm.toString(math.costDelta(b, q, outcome, delta)), ";", ps
                )
            );
        }
    }
}
