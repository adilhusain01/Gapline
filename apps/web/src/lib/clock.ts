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
 * Unix seconds rounded down to a multiple of `step`. The caller re-renders only when that value moves, so a
 * contract read keyed on it keeps the same query for `step` seconds instead of a new one on every render.
 */
export function useNow(step = 1) {
	return useSyncExternalStore(
		subscribe,
		() => Math.floor(Date.now() / 1000 / step) * step,
	);
}
