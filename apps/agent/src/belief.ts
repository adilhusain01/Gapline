import cdf from "@stdlib/stats-base-dists-normal-cdf";

import { config } from "./config";

export type Belief = { meanPct: number; sigmaPct: number; probabilities: number[] };

/**
 * Probability of each reopening range under a normal model of the gap. The mean blends the Uniswap TSLA price
 * (when a deep enough pool is available) with the weekend BTC move scaled by the fitted beta, plus the analyst's
 * bounded drift. The 50/50 blend had the lowest error in the backtest (docs/backtest.md).
 */
export function beliefFor(
  edgesBps: readonly bigint[],
  cryptoMovePct: number,
  dexGapPct?: number,
  analystDriftPct = 0,
  analystConfidence = 0,
): Belief {
  const drift = Math.max(-config.analystMaxDriftPct, Math.min(config.analystMaxDriftPct, analystDriftPct)) * analystConfidence;
  const btcGap = config.btcBeta * cryptoMovePct;
  const base = dexGapPct === undefined ? btcGap : config.dexWeight * dexGapPct + (1 - config.dexWeight) * btcGap;
  const meanPct = base + drift;
  const sigmaPct = config.sigmaPct;

  const edges = edgesBps.map((bps) => Number(bps) / 100);
  const cuts = [0, ...edges.map((edge) => cdf(edge, meanPct, sigmaPct)), 1];
  const probabilities = cuts.slice(1).map((cut, i) => Math.max(cut - cuts[i], 1e-4));
  const total = probabilities.reduce((a, b) => a + b, 0);
  return { meanPct, sigmaPct, probabilities: probabilities.map((p) => p / total) };
}

/**
 * Shares of one range to buy (positive) or sell (negative) so an LMSR price moves from p toward t,
 * holding the other ranges fixed: delta = b * ln( t(1-p) / (p(1-t)) ).
 */
export function sharesToMove(liquidity: number, p: number, t: number) {
  return liquidity * Math.log((t * (1 - p)) / (p * (1 - t)));
}
