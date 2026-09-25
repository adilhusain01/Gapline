import { useSyncExternalStore } from "react";

// One 1 s ticker shared by every subscriber, running only while something is mounted.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
	listeners.add(listener);
	timer ??= setInterval(() => {
		for (const notify of listeners) notify();
	}, 1000);
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			clearInterval(timer);
			timer = undefined;
		}
	};
}

/**
 * Chain time minus wall-clock time, in seconds. Zero on Robinhood Chain testnet; on /demo the private fork is
 * held on a Saturday, and the demo controller reports how far ahead it runs.
 */
let offset = 0;

export function setChainOffset(seconds: number) {
	if (seconds === offset) return;
	offset = seconds;
	for (const notify of listeners) notify();
}

/** The chain's current time in unix seconds; contracts decide sessions and settlement by block.timestamp. */
export function chainNow() {
	return Math.floor(Date.now() / 1000) + offset;
}

/**
 * Chain time rounded down to a multiple of `step`. The caller re-renders only when that value moves, so a
 * contract read keyed on it keeps the same query for `step` seconds instead of a new one on every render.
 */
export function useNow(step = 1) {
	return useSyncExternalStore(
		subscribe,
		() => Math.floor(chainNow() / step) * step,
	);
}
