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

  // Keeper: the market it opens at each close.
  depth: num("AGENT_DEPTH", 20), // LMSR b, in shares; seed cost is b * ln(7) USDG
  // Ranges sized to real gaps: the 13 weekend closures in the feed's history had a 0.8% RMS reopening move (docs/backtest.md).
  edgesBps: [-300n, -100n, -25n, 25n, 100n, 300n] as const,
  tailWidthBps: 200n,

  // Pricing agent: belief about the reopening move.
  // Fitted on every weekend closure in the feed's history (docs/backtest.md); small sample, so kept conservative.
  sigmaPct: num("AGENT_SIGMA_PCT", 0.75), // blend residual RMS was 0.51%, raw gap RMS 0.80%
  btcBeta: num("AGENT_BTC_BETA", 0.35), // least-squares beta of the reopening gap on the weekend BTC move
  dexWeight: num("AGENT_DEX_WEIGHT", 0.5), // 50/50 DEX + BTC had the lowest error on the 9 weekends with DEX data
  minDexTvlUsd: num("AGENT_MIN_DEX_TVL_USD", 100_000), // ignore the pool when it is thinner than this
  maxDexDeviationPct: num("AGENT_MAX_DEX_DEVIATION_PCT", 10), // and when it prints this far from Friday's close
  analystMaxDriftPct: num("AGENT_ANALYST_MAX_DRIFT_PCT", 2.0),
  analystEveryMin: num("AGENT_ANALYST_EVERY_MIN", 120),

  // Pricing agent: hard risk limits.
  minEdge: num("AGENT_MIN_EDGE", 0.03), // act only when belief and market differ by 3 points
  aggressiveness: num("AGENT_AGGRESSIVENESS", 0.5), // fraction of the gap to close per trade
  maxSpendPerTradeUsdg: num("AGENT_MAX_SPEND_PER_TRADE", 5),
  maxExposureUsdg: num("AGENT_MAX_EXPOSURE", 25), // net USDG at risk per market
} as const;

export type Config = typeof config;
