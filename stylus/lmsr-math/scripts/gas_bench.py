#!/usr/bin/env python3
"""Gas of the Stylus LmsrMath against the Solidity reference LmsrMathSol, both live on Robinhood Chain testnet.

    python3 stylus/lmsr-math/scripts/gas_bench.py [stylus] [solidity] [rpc]

Prints eth_estimateGas for the same cost / costDelta / prices calls at 2, 7 (Gapline's markets) and 16 outcomes,
plus ArbWasm's per-call init gas for the Stylus program, cached and uncached.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEPLOYMENT = json.loads((ROOT / "contracts/deployments/46630.json").read_text())

stylus = sys.argv[1] if len(sys.argv) > 1 else DEPLOYMENT["lmsrMath"]
# LmsrMathSol deployed once on testnet (2026-09-23) as the benchmark baseline; GapMarket does not use it.
solidity = sys.argv[2] if len(sys.argv) > 2 else "0x8223BBbe2d37e9623faE882888A97C55E2F95BFB"
rpc = sys.argv[3] if len(sys.argv) > 3 else "https://rpc.testnet.chain.robinhood.com"
ARB_WASM = "0x0000000000000000000000000000000000000071"
B = str(10 * 10**18)


def cast(command, *args):
    # Options before "--" so negative arguments are not parsed as flags.
    out = subprocess.run(["cast", command, "--rpc-url", rpc, "--", *args], capture_output=True, text=True, check=True)
    return out.stdout.strip()


def estimate(address, signature, *args):
    return int(cast("estimate", address, signature, *args))


init, init_cached = (int(x.split(" ")[0]) for x in cast("call", ARB_WASM, "programInitGas(address)(uint64,uint64)", stylus).splitlines())
print(f"Stylus program init gas per call: {init} uncached, {init_cached} cached")
print(f"{'outcomes':>8} {'function':<10} {'stylus':>8} {'solidity':>9} {'change':>8}")
for n in (2, 7, 16):
    shares = "[" + ",".join(str((i * 1_300_000_000_000_000_000) % (9 * 10**18)) for i in range(n)) + "]"
    calls = [
        ("cost(int256,int256[])", (B, shares)),
        ("costDelta(int256,int256[],uint8,int256)", (B, shares, "1", "1500000000000000000")),
        ("prices(int256,int256[])", (B, shares)),
    ]
    for signature, args in calls:
        s, e = estimate(stylus, signature, *args), estimate(solidity, signature, *args)
        print(f"{n:>8} {signature.split('(')[0]:<10} {s:>8} {e:>9} {100 * (s / e - 1):>+7.1f}%")
