"""Regenerate src/exp2_table.rs from PRBMath's exp2() so the Stylus port uses the exact same constants.

    python3 scripts/gen_exp2_table.py
"""
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent.parent
COMMON = HERE.parent.parent / "contracts/lib/prb-math/src/Common.sol"

src = COMMON.read_text()
body = src[src.index("function exp2(uint256 x)"):]
body = body[: body.index("result *= UNIT;")]
pairs = re.findall(r"if \(x & (0x[0-9A-Fa-f]+) > 0\) \{\s*result = \(result \* (0x[0-9A-Fa-f]+)\) >> 64;", body)
assert len(pairs) == 64, f"expected 64 factors, found {len(pairs)}"

lines = [
    "// Generated from PRBMath v4.2.0 src/Common.sol exp2() by scripts/gen_exp2_table.py; do not edit by hand.",
    "// Each entry: (bit of the fractional part, sqrt(2^-i) factor in 1.64 fixed point).",
    "pub(crate) const EXP2_FACTORS: [(u64, u128); 64] = [",
    *[f"    ({mask}, {factor})," for mask, factor in pairs],
    "];",
]
(HERE / "src/exp2_table.rs").write_text("\n".join(lines) + "\n")
print(f"wrote {len(pairs)} factors")
