//! LmsrMath: the LMSR market maker's pricing math as an Arbitrum Stylus contract.
//!
//! GapMarket calls this for every quote and trade. The fixed-point exp/ln are a line-for-line port of PRBMath
//! v4.2.0 (the same library the Solidity reference `LmsrMathSol` uses), so both implementations return identical
//! results; `tests/vectors.rs` checks that against outputs produced by PRBMath itself.
//!
//! ABI (Solidity view):
//!   cost(int256 liquidity, int256[] shares) returns (int256)
//!   costDelta(int256 liquidity, int256[] shares, uint8 outcome, int256 delta) returns (int256)
//!   prices(int256 liquidity, int256[] shares) returns (uint256[])
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

pub mod fixed;
mod exp2_table;

use alloc::vec::Vec;
use alloy_primitives::{I256, U256};
use stylus_sdk::prelude::*;

use fixed::{MathError, div, exp, ln, mul};

/// Weights exp((q_i - max) / b) and their sum; every exponent is <= 0, so nothing can overflow.
fn weights(liquidity: I256, shares: &[I256]) -> Result<(Vec<I256>, I256), MathError> {
    let q_max = shares.iter().copied().max().unwrap_or(I256::ZERO);
    let mut total = I256::ZERO;
    let mut w = Vec::with_capacity(shares.len());
    for &q in shares {
        let wi = exp(div(q - q_max, liquidity)?)?;
        total += wi;
        w.push(wi);
    }
    Ok((w, total))
}

/// LMSR cost C(q) = max + b * ln(sum exp((q_i - max) / b)).
pub fn cost(liquidity: I256, shares: &[I256]) -> Result<I256, MathError> {
    let (_, total) = weights(liquidity, shares)?;
    let q_max = shares.iter().copied().max().unwrap_or(I256::ZERO);
    Ok(q_max + mul(liquidity, ln(total)?)?)
}

/// C(q + delta * e_outcome) - C(q): positive for buys, negative for sells.
pub fn cost_delta(liquidity: I256, shares: &[I256], outcome: usize, delta: I256) -> Result<I256, MathError> {
    let before = cost(liquidity, shares)?;
    let mut moved = shares.to_vec();
    moved[outcome] += delta;
    Ok(cost(liquidity, &moved)? - before)
}

/// Price of each outcome, 18 decimals, summing to ~1e18.
pub fn prices(liquidity: I256, shares: &[I256]) -> Result<Vec<U256>, MathError> {
    let (w, total) = weights(liquidity, shares)?;
    w.into_iter().map(|wi| div(wi, total).map(|p| p.into_raw())).collect()
}

fn revert(error: MathError) -> Vec<u8> {
    let reason: &[u8] = match error {
        MathError::ExpInputTooBig => b"LmsrMath: exp input too big",
        MathError::Exp2InputTooBig => b"LmsrMath: exp2 input too big",
        MathError::LogInputTooSmall => b"LmsrMath: log input too small",
        MathError::Overflow => b"LmsrMath: overflow",
        MathError::DivisionByZero => b"LmsrMath: division by zero",
    };
    reason.to_vec()
}

sol_storage! {
    #[entrypoint]
    pub struct LmsrMath {}
}

#[public]
impl LmsrMath {
    pub fn cost(&self, liquidity: I256, shares: Vec<I256>) -> Result<I256, Vec<u8>> {
        cost(liquidity, &shares).map_err(revert)
    }

    pub fn cost_delta(&self, liquidity: I256, shares: Vec<I256>, outcome: u8, delta: I256) -> Result<I256, Vec<u8>> {
        let index = usize::from(outcome);
        if index >= shares.len() {
            return Err(b"LmsrMath: bad outcome".to_vec());
        }
        cost_delta(liquidity, &shares, index, delta).map_err(revert)
    }

    pub fn prices(&self, liquidity: I256, shares: Vec<I256>) -> Result<Vec<U256>, Vec<u8>> {
        prices(liquidity, &shares).map_err(revert)
    }
}

#[cfg(test)]
mod vector_tests {
    //! Bit-exact parity with PRBMath: vectors in tests/vectors/ are produced by
    //! `forge script script/LmsrVectors.s.sol`, which runs the Solidity reference.
    use super::*;
    use alloy_primitives::{I256, U256};

    fn int(s: &str) -> I256 {
        I256::from_dec_str(s.trim()).expect("int256")
    }
    fn uint(s: &str) -> U256 {
        U256::from_str_radix(s.trim(), 10).expect("uint256")
    }
    fn lines(file: &str) -> Vec<String> {
        let path = format!("{}/tests/vectors/{}", env!("CARGO_MANIFEST_DIR"), file);
        std::fs::read_to_string(&path)
            .unwrap_or_else(|_| panic!("missing {path}; run the forge vector script"))
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(str::to_owned)
            .collect()
    }

    #[test]
    fn exp_matches_prbmath_exactly() {
        let cases = lines("exp.csv");
        for line in &cases {
            let (x, expected) = line.split_once(',').unwrap();
            assert_eq!(fixed::exp(int(x)).unwrap(), int(expected), "exp({x})");
        }
        assert!(cases.len() >= 400);
    }

    #[test]
    fn ln_matches_prbmath_exactly() {
        let cases = lines("ln.csv");
        for line in &cases {
            let (x, expected) = line.split_once(',').unwrap();
            assert_eq!(fixed::ln(int(x)).unwrap(), int(expected), "ln({x})");
        }
        assert!(cases.len() >= 400);
    }

    #[test]
    fn lmsr_matches_solidity_reference_exactly() {
        let cases = lines("lmsr.csv");
        for line in &cases {
            let f: Vec<&str> = line.split(';').collect();
            let b = int(f[0]);
            let q: Vec<I256> = f[1].split(',').map(int).collect();
            let outcome: usize = f[2].parse().unwrap();
            let delta = int(f[3]);
            assert_eq!(cost(b, &q).unwrap(), int(f[4]), "cost {line}");
            assert_eq!(cost_delta(b, &q, outcome, delta).unwrap(), int(f[5]), "costDelta {line}");
            let expected: Vec<U256> = f[6].split(',').map(uint).collect();
            assert_eq!(prices(b, &q).unwrap(), expected, "prices {line}");
        }
        assert!(cases.len() >= 240);
    }

    #[test]
    fn rejects_bad_inputs_like_prbmath() {
        assert_eq!(fixed::ln(I256::ZERO), Err(fixed::MathError::LogInputTooSmall));
        assert_eq!(fixed::exp(fixed::i(134_000_000_000_000_000_000)), Err(fixed::MathError::ExpInputTooBig));
        assert_eq!(fixed::div(fixed::i(1), I256::ZERO), Err(fixed::MathError::DivisionByZero));
    }
}
