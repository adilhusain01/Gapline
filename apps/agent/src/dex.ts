import { MAINNET_USDG, type StockSymbol, stocks } from "@gapline/abi";
import { parseAbiItem } from "viem";

import { mainnet } from "./chain";

// Each stock's deepest Uniswap v3 pool against USDG on mainnet (MAINNET_STOCKS in @gapline/abi):
// TSLA/USDG 0.3% (~$660K) and AMZN/USDG 0.3% (~$869K) on 2026-09-23. token0 = stock (18 dec), token1 = USDG (6 dec).

const slot0Abi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
] as const;
const swapEvent = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
);

/** USDG per stock token from a v3 sqrtPriceX96 (token1 per token0, adjusted for 18 vs 6 decimals). */
export function priceFromSqrt(sqrtPriceX96: bigint) {
  const ratio = Number(sqrtPriceX96) / 2 ** 96;
  return ratio * ratio * 1e12;
}

/** The pool's price right now. */
export async function dexPriceNow(symbol: StockSymbol) {
  const [sqrtPriceX96] = await mainnet.readContract({ address: stocks[symbol].usdgPool, abi: slot0Abi, functionName: "slot0" });
  return priceFromSqrt(sqrtPriceX96);
}

/** First block at or after `timestamp`, by binary search (the public node has no timestamp index). */
export async function blockAt(timestamp: bigint) {
  const latest = await mainnet.getBlock();
  let lo = 1n;
  let hi = latest.number;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const block = await mainnet.getBlock({ blockNumber: mid });
    if (block.timestamp < timestamp) lo = mid + 1n;
    else hi = mid;
  }
  return lo;
}

/**
 * The pool's price at `timestamp`: the post-swap price of the last swap before it.
 * The public node keeps no historical state, but it serves logs. Searches back up to `lookbackBlocks`.
 */
export async function dexPriceAt(symbol: StockSymbol, timestamp: bigint, lookbackBlocks = 400_000n) {
  const end = await blockAt(timestamp);
  // The public node times out on wide log queries; start small and halve on failure.
  let chunk = 5_000n;
  for (let to = end; to > end - lookbackBlocks && to > 0n; ) {
    const from = to > chunk ? to - chunk + 1n : 1n;
    const logs = await mainnet
      .getLogs({ address: stocks[symbol].usdgPool, event: swapEvent, fromBlock: from, toBlock: to })
      .catch(() => undefined);
    if (!logs) {
      if (chunk <= 250n) throw new Error(`log query keeps timing out near block ${to}`);
      chunk /= 2n;
      continue;
    }
    to = from - 1n;
    const last = logs.at(-1);
    if (last?.args.sqrtPriceX96) {
      const block = await mainnet.getBlock({ blockNumber: last.blockNumber });
      return { price: priceFromSqrt(last.args.sqrtPriceX96), at: block.timestamp };
    }
  }
  return undefined;
}

const erc20BalanceAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/**
 * The live weekend signal. `usable` is false when the pool is too thin or prints too far from Friday's close to
 * trust; depth filtering keeps a thin pool's fake print (e.g. a $1,153 NVDA pool against a $218 stock) out.
 */
export async function dexSignal(symbol: StockSymbol, fridayClose: number, minTvlUsd: number, maxDeviationPct: number) {
  const { token, usdgPool } = stocks[symbol];
  const [price, stockHeld, usdg] = await Promise.all([
    dexPriceNow(symbol),
    mainnet.readContract({ address: token, abi: erc20BalanceAbi, functionName: "balanceOf", args: [usdgPool] }),
    mainnet.readContract({ address: MAINNET_USDG, abi: erc20BalanceAbi, functionName: "balanceOf", args: [usdgPool] }),
  ]);
  const tvlUsd = (Number(stockHeld) / 1e18) * price + Number(usdg) / 1e6;
  const gapPct = (price / fridayClose - 1) * 100;
  const usable = tvlUsd >= minTvlUsd && Math.abs(gapPct) <= maxDeviationPct;
  return { price, tvlUsd, gapPct, usable };
}
