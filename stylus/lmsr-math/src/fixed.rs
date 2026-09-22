//! SD59x18 fixed-point math, ported line for line from PRBMath v4.2.0 so results are bit-identical.
//! Stylus forbids floating point, so everything is 256-bit integer arithmetic on 18-decimal values.

use alloy_primitives::{I256, U256};

use crate::exp2_table::EXP2_FACTORS;

pub const UNIT: i128 = 1_000_000_000_000_000_000;
const HALF_UNIT: i128 = 500_000_000_000_000_000;
const LOG2_E: i128 = 1_442_695_040_888_963_407;
const EXP_MIN_THRESHOLD: i128 = -41_446_531_673_892_822_322;
const EXP_MAX_INPUT: i128 = 133_084_258_667_509_499_440;
const EXP2_MIN_THRESHOLD: i128 = -59_794_705_707_972_522_261;
const EXP2_MAX_INPUT: i128 = 192_000_000_000_000_000_000 - 1;

#[derive(Debug, PartialEq, Eq)]
pub enum MathError {
    ExpInputTooBig,
    Exp2InputTooBig,
    LogInputTooSmall,
    Overflow,
    DivisionByZero,
}

pub fn i(x: i128) -> I256 {
    I256::try_from(x).expect("i128 fits in I256")
}

fn unit() -> I256 {
    i(UNIT)
}

/// PRBMath Common.exp2: 2^x for x in 192.64-bit binary fixed point, returned as 60.18 decimal.
fn common_exp2(x: U256) -> U256 {
    // Start from 0.5 in 192.64-bit fixed point.
    let mut result = U256::from(1u8) << 191;
    let frac = x.as_limbs()[0];
    for &(mask, factor) in EXP2_FACTORS.iter() {
        if frac & mask != 0 {
            result = (result * U256::from(factor)) >> 64;
        }
    }
    result *= U256::from(UNIT as u128);
    let integer_part: usize = (x >> 64usize).to::<usize>();
    result >> (191 - integer_part)
}

/// PRBMath Common.msb: index of the most significant bit.
fn msb(x: U256) -> usize {
    if x.is_zero() {
        0
    } else {
        255 - x.leading_zeros()
    }
}

/// SD59x18 exp2.
pub fn exp2(x: I256) -> Result<I256, MathError> {
    if x.is_negative() {
        if x < i(EXP2_MIN_THRESHOLD) {
            return Ok(I256::ZERO);
        }
        let positive = exp2(-x)?;
        return Ok(i(UNIT) * i(UNIT) / positive);
    }
    if x > i(EXP2_MAX_INPUT) {
        return Err(MathError::Exp2InputTooBig);
    }
    let x192x64 = ((x << 64usize) / unit()).into_raw();
    Ok(I256::from_raw(common_exp2(x192x64)))
}

/// SD59x18 exp: e^x = 2^(x * log2(e)).
pub fn exp(x: I256) -> Result<I256, MathError> {
    if x < i(EXP_MIN_THRESHOLD) {
        return Ok(I256::ZERO);
    }
    if x > i(EXP_MAX_INPUT) {
        return Err(MathError::ExpInputTooBig);
    }
    let double_unit_product = x * i(LOG2_E);
    exp2(double_unit_product / unit())
}

/// SD59x18 log2, by iterative squaring.
pub fn log2(x: I256) -> Result<I256, MathError> {
    if x <= I256::ZERO {
        return Err(MathError::LogInputTooSmall);
    }
    let (mut x_int, sign) = if x >= unit() { (x, i(1)) } else { (i(UNIT) * i(UNIT) / x, i(-1)) };
    let n = msb((x_int / unit()).into_raw());
    let mut result = i(n as i128) * unit();
    let mut y = x_int >> n;
    if y == unit() {
        return Ok(result * sign);
    }
    let double_unit = i(2 * UNIT);
    let mut delta = i(HALF_UNIT);
    while delta > I256::ZERO {
        y = (y * y) / unit();
        if y >= double_unit {
            result += delta;
            y >>= 1;
        }
        delta >>= 1;
    }
    x_int = result * sign;
    Ok(x_int)
}

/// SD59x18 natural logarithm: ln(x) = log2(x) / log2(e).
pub fn ln(x: I256) -> Result<I256, MathError> {
    Ok(log2(x)? * unit() / i(LOG2_E))
}

/// SD59x18 multiplication, rounding toward zero like PRBMath's mulDiv18.
pub fn mul(x: I256, y: I256) -> Result<I256, MathError> {
    let product = x.unsigned_abs().checked_mul(y.unsigned_abs()).ok_or(MathError::Overflow)?;
    let abs = I256::try_from(product / U256::from(UNIT as u128)).map_err(|_| MathError::Overflow)?;
    Ok(if x.is_negative() != y.is_negative() { -abs } else { abs })
}

/// SD59x18 division, rounding toward zero like PRBMath's mulDiv.
pub fn div(x: I256, y: I256) -> Result<I256, MathError> {
    if y.is_zero() {
        return Err(MathError::DivisionByZero);
    }
    let scaled = x.unsigned_abs().checked_mul(U256::from(UNIT as u128)).ok_or(MathError::Overflow)?;
    let abs = I256::try_from(scaled / y.unsigned_abs()).map_err(|_| MathError::Overflow)?;
    Ok(if x.is_negative() != y.is_negative() { -abs } else { abs })
}
