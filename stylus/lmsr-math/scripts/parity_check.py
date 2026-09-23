#!/usr/bin/env python3
"""On-chain parity check: the deployed Stylus LmsrMath against the PRBMath vectors.

Calls cost, costDelta and prices on the live program for every market in tests/vectors/lmsr.csv
(written by contracts/script/LmsrVectors.s.sol from the Solidity reference) and requires identical results.

    python3 stylus/lmsr-math/scripts/parity_check.py [address] [rpc]

Defaults: lmsrMath from contracts/deployments/46630.json, the public Robinhood Chain testnet RPC. Needs `cast`.
"""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
VECTORS = ROOT / "stylus/lmsr-math/tests/vectors/lmsr.csv"
DEPLOYMENT = ROOT / "contracts/deployments/46630.json"

address = sys.argv[1] if len(sys.argv) > 1 else json.loads(DEPLOYMENT.read_text())["lmsrMath"]
rpc = sys.argv[2] if len(sys.argv) > 2 else "https://rpc.testnet.chain.robinhood.com"


def call(signature, *args):
    # "--" before the arguments so negative deltas are not parsed as flags.
    for _ in range(3):
        out = subprocess.run(
            ["cast", "call", address, signature, "--rpc-url", rpc, "--", *args], capture_output=True, text=True
        )
        if out.returncode == 0:
            return out.stdout.strip()
    raise RuntimeError(out.stderr.strip())


def first(value):
    """cast prints '123 [1.23e2]'; keep the exact integer."""
    return value.split(" ")[0]


def check(row):
    b, q, outcome, delta, cost, cost_delta, prices = row
    shares = f"[{q}]"
    got_cost = first(call("cost(int256,int256[])(int256)", b, shares))
    got_delta = first(call("costDelta(int256,int256[],uint8,int256)(int256)", b, shares, outcome, delta))
    got_prices = [first(p) for p in call("prices(int256,int256[])(uint256[])", b, shares).strip("[]").split(", ")]
    return got_cost == cost, got_delta == cost_delta, got_prices == prices.split(",")


rows = [line.strip().split(";") for line in VECTORS.read_text().splitlines() if line.strip()]
with ThreadPoolExecutor(12) as pool:
    results = list(pool.map(check, rows))

totals = [sum(r[i] for r in results) for i in range(3)]
print(f"Stylus LmsrMath at {address}: cost {totals[0]}/{len(rows)}, costDelta {totals[1]}/{len(rows)}, prices {totals[2]}/{len(rows)}")
sys.exit(0 if all(t == len(rows) for t in totals) else 1)
