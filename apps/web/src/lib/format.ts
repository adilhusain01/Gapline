import { formatUnits } from "viem";

export const PRICE_DECIMALS = 8;
export const USDG_DECIMALS = 6;

export function usd(
	value: bigint | undefined,
	decimals = PRICE_DECIMALS,
	digits = 2,
) {
	if (value === undefined) return "--";
	return Number(formatUnits(value, decimals)).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
}

export function usdg(value: bigint | undefined, digits = 2) {
	if (value === undefined) return "--";
	return `${Number(formatUnits(value, USDG_DECIMALS)).toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	})} USDG`;
}

export function percent(value: number, digits = 1) {
	return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function bpsToPercent(bps: bigint | number) {
	return Number(bps) / 100;
}

/** "-5% or worse", "-2% to -0.5%", "+5% or better" for range index i. */
export function rangeLabel(edges: readonly bigint[], index: number) {
	if (index === 0) return `${bpsToPercent(edges[0]).toFixed(2)}% or worse`;
	if (index === edges.length)
		return `${percent(bpsToPercent(edges[edges.length - 1]), 2)} or better`;
	return `${percent(bpsToPercent(edges[index - 1]), 2)} to ${percent(bpsToPercent(edges[index]), 2)}`;
}

export function shortAddress(address?: string) {
	return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

export function countdown(seconds: number) {
	if (seconds <= 0) return "now";
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m ${Math.floor(seconds % 60)}s`;
}

/** A timestamp in the market's own clock, e.g. "Fri 20:00 ET". */
export function marketTime(timestamp: bigint | number) {
	const text = new Date(Number(timestamp) * 1000).toLocaleString("en-US", {
		timeZone: "America/New_York",
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	return `${text} ET`;
}
