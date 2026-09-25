import { STOCK_SYMBOLS, type StockSymbol } from "@gapline/abi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setChainOffset } from "@/lib/clock";
import { percent } from "@/lib/format";
import { useUi } from "@/lib/store";
import { DEMO_API } from "@/lib/wagmi";

export type DemoState = {
	phase: "starting" | "saturday" | "reopening" | "settled" | "error";
	busy: boolean;
	close: string;
	reopen: string;
	refs: Partial<Record<StockSymbol, string>>;
	moves: Partial<Record<StockSymbol, number>>;
	wallet: string;
	clockOffset: number;
	error: string;
	log: string[];
};

/** The demo controller's state, polled; also keeps the app's clock on the fork's time. */
export function useDemoState() {
	const query = useQuery({
		queryKey: ["demo-state"],
		queryFn: async () => {
			const response = await fetch(`${DEMO_API}/state`);
			if (!response.ok) throw new Error(`demo controller: ${response.status}`);
			return (await response.json()) as DemoState;
		},
		refetchInterval: 3000,
		staleTime: 0,
	});
	const offset = query.data?.clockOffset;
	useEffect(() => {
		if (offset !== undefined) setChainOffset(offset);
	}, [offset]);
	return query;
}

async function post(path: string, body?: unknown) {
	const response = await fetch(`${DEMO_API}${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body ?? {}),
	});
	if (!response.ok) {
		const { error } = (await response.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new Error(error ?? `request failed (${response.status})`);
	}
}

const DEFAULT_MOVES: Record<StockSymbol, string> = {
	TSLA: "-3.5",
	AMZN: "0.8",
};

/** "[keeper] open TSLA market ... success  tx 0xabc..." without the hash. */
function shortLine(line: string) {
	return line.replace(/\s+tx 0x[0-9a-f]+/i, "").replace(/\s{2,}/g, " ");
}

export function DemoPanel({ state }: { state: DemoState }) {
	const queryClient = useQueryClient();
	const selectMarket = useUi((s) => s.selectMarket);
	const [moves, setMoves] = useState(DEFAULT_MOVES);
	const [sending, setSending] = useState(false);

	// A new fork or a settled one changes every on-chain number: refetch them all.
	const lastPhase = useRef(state.phase);
	useEffect(() => {
		if (lastPhase.current === state.phase) return;
		lastPhase.current = state.phase;
		if (state.phase === "saturday") selectMarket(null);
		void queryClient.invalidateQueries({
			predicate: (query) => query.queryKey[0] !== "demo-state",
		});
	}, [state.phase, queryClient, selectMarket]);

	async function run(path: string, body?: unknown) {
		setSending(true);
		try {
			await post(path, body);
			await queryClient.invalidateQueries({ queryKey: ["demo-state"] });
		} catch (error) {
			toast.error("Demo", {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setSending(false);
		}
	}

	function reopen() {
		const bps = Object.fromEntries(
			STOCK_SYMBOLS.map((symbol) => [
				symbol,
				Math.round(Number.parseFloat(moves[symbol] || "0") * 100) || 0,
			]),
		);
		void run("/reopen", { moves: bps });
	}

	const working = sending || state.busy || state.phase === "reopening";

	return (
		<Card className="border-band/40">
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="max-w-2xl space-y-1">
						<p className="font-medium">
							{state.phase === "settled"
								? "Demo weekend: settled"
								: state.phase === "reopening"
									? "Demo weekend: reopening"
									: "Demo weekend: Saturday"}
						</p>
						<p className="text-sm text-muted-foreground">
							A private copy of Robinhood Chain testnet with its clock on the
							weekend, shared by everyone on this page. You trade as a demo
							wallet funded with 100 USDG, 5 TSLA and 5 AMZN. Nothing here
							touches the real chain.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={working}
						onClick={() => run("/reset")}
					>
						Start over
					</Button>
				</div>

				{state.phase === "saturday" ? (
					<div className="flex flex-wrap items-end gap-3">
						{STOCK_SYMBOLS.map((symbol) => (
							<div key={symbol} className="space-y-1.5">
								<Label htmlFor={`move-${symbol}`}>
									{symbol} reopens at (%)
								</Label>
								<Input
									id={`move-${symbol}`}
									inputMode="decimal"
									className="w-28 font-mono"
									value={moves[symbol]}
									onChange={(event) =>
										setMoves({ ...moves, [symbol]: event.target.value })
									}
								/>
							</div>
						))}
						<Button disabled={working} onClick={reopen}>
							{working ? <Loader2 className="size-4 animate-spin" /> : null}
							Jump to the Sunday reopen
						</Button>
					</div>
				) : state.phase === "reopening" ? (
					<p className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Posting the reopening prices; the agent settles both markets.
					</p>
				) : (
					<p className="text-sm text-muted-foreground">
						Both markets settled on the reopening prices (
						{STOCK_SYMBOLS.map((symbol, i) => (
							<span key={symbol}>
								{i > 0 ? ", " : ""}
								{symbol} {percent((state.moves[symbol] ?? 0) / 100, 2)}
							</span>
						))}
						). Redeem winning shares here, or see each pool's cover on Borrow.
					</p>
				)}

				{state.log.length > 0 ? (
					<details className="text-xs text-muted-foreground">
						<summary className="cursor-pointer select-none">
							Agent activity
						</summary>
						<ul className="mt-2 space-y-1 font-mono">
							{state.log.map((line) => (
								<li key={line} className="break-words">
									{shortLine(line)}
								</li>
							))}
						</ul>
					</details>
				) : null}
			</CardContent>
		</Card>
	);
}
