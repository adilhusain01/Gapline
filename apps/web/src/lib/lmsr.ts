/**
 * Client-side mirror of GapMarket's LMSR pricing, used for "what would it cost" displays.
 * Floating point is fine here: these are estimates for the UI, the contract quotes the exact amounts.
 */

type LmsrMarket = {
	liquidity: bigint;
	shares: readonly bigint[];
	edges: readonly bigint[];
	tailWidthBps: bigint;
};

const toShares = (x: bigint) => Number(x) / 1e18;

/** C(q) = b * ln(sum exp(q_i / b)), computed with the max subtracted for stability. */
function cost(b: number, q: number[]) {
	const max = Math.max(...q);
	return (
		max + b * Math.log(q.reduce((sum, qi) => sum + Math.exp((qi - max) / b), 0))
	);
}

function prices(b: number, q: number[]) {
	const max = Math.max(...q);
	const w = q.map((qi) => Math.exp((qi - max) / b));
	const total = w.reduce((a, c) => a + c, 0);
	return w.map((wi) => wi / total);
}

/** Representative move of each range in bps, matching GapMarket._representativeBps. */
function representatives(edges: number[], tail: number) {
	return Array.from({ length: edges.length + 1 }, (_, i) =>
		i === 0
			? edges[0] - tail
			: i === edges.length
				? edges[edges.length - 1] + tail
				: (edges[i - 1] + edges[i]) / 2,
	);
}

const meanBps = (p: number[], reps: number[]) =>
	p.reduce((sum, pi, i) => sum + pi * reps[i], 0);

/**
 * USDG, fee included, it takes to shift the implied mean move by `deltaBps`, buying the outermost range in that
 * direction. This is the manipulation cost: what an attacker pays the market maker to move the oracle.
 * Returns undefined when even 50x the market's depth cannot move it that far.
 */
export function costToShiftMean(
	market: LmsrMarket,
	deltaBps: number,
	feeBps = 100,
) {
	const b = toShares(market.liquidity);
	const q = market.shares.map(toShares);
	const reps = representatives(
		market.edges.map(Number),
		Number(market.tailWidthBps),
	);
	const start = meanBps(prices(b, q), reps);
	const outcome = deltaBps < 0 ? 0 : q.length - 1;
	const moved = (x: number) => {
		const next = [...q];
		next[outcome] += x;
		return next;
	};

	// Binary search the shares needed; the mean moves monotonically with shares bought in an outer range.
	let lo = 0;
	let hi = b * 50;
	if (
		Math.abs(meanBps(prices(b, moved(hi)), reps) - start) < Math.abs(deltaBps)
	)
		return undefined;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		const shift = meanBps(prices(b, moved(mid)), reps) - start;
		if (Math.abs(shift) < Math.abs(deltaBps)) lo = mid;
		else hi = mid;
	}
	const base = cost(b, moved(hi)) - cost(b, q);
	return base * (1 + feeBps / 10_000);
}
