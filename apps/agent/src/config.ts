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
  edgesBps: [-500n, -200n, -50n, 50n, 200n, 500n] as const,
  tailWidthBps: 300n,

  // Pricing agent: belief about the reopening move.
  sigmaPct: num("AGENT_SIGMA_PCT", 2.0), // std-dev of a TSLA weekend gap
  btcBeta: num("AGENT_BTC_BETA", 0.3), // how much of the weekend BTC move TSLA inherits
  analystMaxDriftPct: num("AGENT_ANALYST_MAX_DRIFT_PCT", 2.0),
  analystEveryMin: num("AGENT_ANALYST_EVERY_MIN", 120),

  // Pricing agent: hard risk limits.
  minEdge: num("AGENT_MIN_EDGE", 0.03), // act only when belief and market differ by 3 points
  aggressiveness: num("AGENT_AGGRESSIVENESS", 0.5), // fraction of the gap to close per trade
  maxSpendPerTradeUsdg: num("AGENT_MAX_SPEND_PER_TRADE", 5),
  maxExposureUsdg: num("AGENT_MAX_EXPOSURE", 25), // net USDG at risk per market
} as const;

export type Config = typeof config;
