/**
 * The landing page's worked example, using the parameters the live markets use: LMSR depth 10, seven ranges
 * (apps/agent/src/config.ts), tails scored 2% past the outer edges, a 1% fee, the oracle's +/- 2 sigma band
 * (ImpliedPriceOracle.bandSigmas) and the lending pool's constants (GapGuardedLendingPool). Floating point is fine:
 * it only illustrates; the contracts use fixed point.
 */

export const EDGES_BPS = [-300, -100, -25, 25, 100, 300];
export const TAIL_BPS = 200;
export const DEPTH = 10;
export const FEE = 0.01;
export const BAND_SIGMAS = 2;
export const MAX_LTV = 0.5;
export const LIQUIDATION_THRESHOLD = 0.7;
/** The pool's cover pays this share of its loans when the worst range wins. */
export const COVER_SHARE = 0.1;

/** Example Friday close. */
export const FRIDAY_CLOSE = 365;

/** Representative move of each range in bps: midpoints, with the open tails TAIL_BPS past the outer edges. */
export const REPRESENTATIVE_BPS = EDGES_BPS.map((_, i) =>
	i === 0 ? EDGES_BPS[0] - TAIL_BPS : (EDGES_BPS[i - 1] + EDGES_BPS[i]) / 2,
).concat(EDGES_BPS[EDGES_BPS.length - 1] + TAIL_BPS);

/** Shares outstanding that give these probabilities: q_i = b ln p_i, shifted so the smallest is 0. */
export function sharesFor(probabilities: number[]) {
	const logs = probabilities.map((p) => DEPTH * Math.log(p));
	const min = Math.min(...logs);
	return logs.map((q) => q - min);
}

/** A plausible Saturday: most weight near no change, a little lean to the downside. */
export const SATURDAY = sharesFor([0.05, 0.15, 0.2, 0.25, 0.2, 0.12, 0.03]);

/** LMSR prices: each range's probability. */
export function prices(q: number[]) {
	const max = Math.max(...q);
	const w = q.map((qi) => Math.exp((qi - max) / DEPTH));
	const total = w.reduce((a, b) => a + b, 0);
	return w.map((wi) => wi / total);
}

/** LMSR cost function C(q) = b ln sum exp(q_i / b). */
function cost(q: number[]) {
	const max = Math.max(...q);
	return (
		max +
		DEPTH * Math.log(q.reduce((s, qi) => s + Math.exp((qi - max) / DEPTH), 0))
	);
}

/** USDG to buy `shares` of range `i`, fee included. */
export function buyCost(q: number[], i: number, shares: number) {
	const next = [...q];
	next[i] += shares;
	return (cost(next) - cost(q)) * (1 + FEE);
}

/** Expected move and its standard deviation in bps, as GapMarket.impliedMove computes them. */
export function impliedMove(q: number[]) {
	const p = prices(q);
	const mean = p.reduce((s, pi, i) => s + pi * REPRESENTATIVE_BPS[i], 0);
	const second = p.reduce((s, pi, i) => s + pi * REPRESENTATIVE_BPS[i] ** 2, 0);
	return { mean, sd: Math.sqrt(Math.max(0, second - mean * mean)) };
}

/** The oracle's price band from Friday's close, as ImpliedPriceOracle.priceBand computes it. */
export function priceBand(q: number[], ref = FRIDAY_CLOSE) {
	const { mean, sd } = impliedMove(q);
	const spread = sd * BAND_SIGMAS;
	return {
		mean,
		sd,
		mid: ref * (1 + mean / 10_000),
		low: Math.max(0, ref * (1 + (mean - spread) / 10_000)),
		high: ref * (1 + (mean + spread) / 10_000),
	};
}

/** The winning range for a reopening move, as GapMarket.resolve picks it: count the edges at or below it. */
export function winningRange(moveBps: number) {
	return EDGES_BPS.filter((edge) => moveBps >= edge).length;
}

/** "-3% or worse", "-3% to -1%", ... for range i. */
export function rangeName(i: number) {
	const pct = (bps: number) =>
		`${bps > 0 ? "+" : ""}${Number.isInteger(bps / 100) ? bps / 100 : (bps / 100).toFixed(2)}%`;
	if (i === 0) return `${pct(EDGES_BPS[0])} or worse`;
	if (i === EDGES_BPS.length)
		return `${pct(EDGES_BPS[EDGES_BPS.length - 1])} or better`;
	return `${pct(EDGES_BPS[i - 1])} to ${pct(EDGES_BPS[i])}`;
}
