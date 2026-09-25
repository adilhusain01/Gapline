import { useNow } from "@/lib/clock";
import { countdown } from "@/lib/format";

/** Time left until `to` (unix seconds), ticking once a second without re-rendering its parent. */
export function Countdown({ to }: { to: bigint | number }) {
	const now = useNow();
	return <>{countdown(Number(to) - now)}</>;
}

/** Time since `from` (unix seconds), e.g. "3m 12s ago", ticking once a second. */
export function TimeAgo({ from }: { from: bigint | number }) {
	const now = useNow();
	return <>{countdown(Math.max(0, now - Number(from)))} ago</>;
}
