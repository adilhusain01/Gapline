import cdf from "@stdlib/stats-base-dists-normal-cdf";

import { config } from "./config";

export type Belief = { meanPct: number; sigmaPct: number; probabilities: number[] };

/**
 * Probability of each reopening range under a normal model of the gap.
 * The mean blends the weekend crypto move (scaled by beta) with the analyst's bounded drift.
 */
export function beliefFor(edgesBps: readonly bigint[], cryptoMovePct: number, analystDriftPct = 0, analystConfidence = 0): Belief {
  const drift = Math.max(-config.analystMaxDriftPct, Math.min(config.analystMaxDriftPct, analystDriftPct)) * analystConfidence;
  const meanPct = config.btcBeta * cryptoMovePct + drift;
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
