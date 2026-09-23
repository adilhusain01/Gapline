import type { StockSymbol } from "@gapline/abi";
import type { Hex } from "viem";

const num = (key: string, fallback: number) => {
  const raw = process.env[key];
  return raw === undefined || raw === "" ? fallback : Number(raw);
};

/** Every knob the agent has. Spending caps are hard limits the trader never exceeds. */
export const config = {
  privateKey: (process.env.AGENT_PRIVATE_KEY ?? process.env.PRIVATE_KEY) as Hex,
  tickMs: num("AGENT_TICK_MS", 60_000),
  dryRun: process.env.AGENT_DRY_RUN === "true",

  // Keeper: the market it opens for each stock at each close.
  // LMSR b, in shares; seed cost is b * ln(7) USDG per market. 10 fits two stocks on one faucet's 100 USDG
  // and is the oracle's minimum depth (MIN_LIQUIDITY in Deploy.s.sol).
  depth: num("AGENT_DEPTH", 10),
  // Ranges sized to real gaps: the 13 weekend closures in the feed's history had a 0.8% RMS reopening move (docs/backtest-TSLA.md).
  edgesBps: [-300n, -100n, -25n, 25n, 100n, 300n] as const,
  tailWidthBps: 200n,

  // Pricing agent: belief about the reopening move (defaults; per-stock fits below override them).
  sigmaPct: num("AGENT_SIGMA_PCT", 0.75),
  btcBeta: num("AGENT_BTC_BETA", 0.35),
  dexWeight: num("AGENT_DEX_WEIGHT", 0.5), // 50/50 DEX + BTC had the lowest error on the weekends with DEX data
  minDexTvlUsd: num("AGENT_MIN_DEX_TVL_USD", 100_000), // ignore the pool when it is thinner than this
  maxDexDeviationPct: num("AGENT_MAX_DEX_DEVIATION_PCT", 10), // and when it prints this far from Friday's close
  analystMaxDriftPct: num("AGENT_ANALYST_MAX_DRIFT_PCT", 2.0),
  analystEveryMin: num("AGENT_ANALYST_EVERY_MIN", 120),

  // Pricing agent: hard risk limits, per market (one market per stock per closure).
  minEdge: num("AGENT_MIN_EDGE", 0.03), // act only when belief and market differ by 3 points
  aggressiveness: num("AGENT_AGGRESSIVENESS", 0.5), // fraction of the gap to close per trade
  maxSpendPerTradeUsdg: num("AGENT_MAX_SPEND_PER_TRADE", 3),
  maxExposureUsdg: num("AGENT_MAX_EXPOSURE", 10), // net USDG at risk per market
} as const;

export type Config = typeof config;

/**
 * Per-stock belief parameters, fitted on every weekend closure in each feed's history
 * (docs/backtest-TSLA.md, docs/backtest-AMZN.md). Small samples, so kept conservative.
 */
const stockOverrides: Record<StockSymbol, Partial<Pick<Config, "btcBeta" | "sigmaPct" | "dexWeight">>> = {
  // BTC beta 0.35; blend residual RMS 0.51%, raw gap RMS 0.80%.
  TSLA: { btcBeta: 0.35, sigmaPct: 0.75 },
  // Least-squares BTC beta 0.20; gaps are smaller (RMS 0.60%) and the deeper Uniswap pool alone had the lowest
  // error (0.28 pp MAE, 0.36 pp RMS), so the blend leans on it while keeping some BTC.
  AMZN: { btcBeta: 0.2, sigmaPct: 0.55, dexWeight: 0.7 },
};

export function stockConfig(symbol: StockSymbol): Config {
  return { ...config, ...stockOverrides[symbol] };
}
