import { gapMarketAbi } from "@gapline/abi";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

import { Countdown } from "@/components/live-time";
import { MarketRanges } from "@/components/market-ranges";
import { OpenMarketCard } from "@/components/open-market-card";
import { PricePanel } from "@/components/price-panel";
import { SecurityBudget } from "@/components/security-budget";
import { TradePanel } from "@/components/trade-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usd, usdg } from "@/lib/format";
import {
	addresses,
	useMarkets,
	useNextClose,
	useSessionStatus,
	useSettlementRound,
	useShareBalances,
	useStock,
} from "@/lib/gapline";
import { useUi } from "@/lib/store";
import { useTx } from "@/lib/useTx";

export const Route = createFileRoute("/app/")({ component: MarketPage });

function MarketPage() {
	const { markets, isLoading } = useMarkets();
	const status = useSessionStatus();
	const stock = useStock();
	const nextClose = useNextClose();
	const { selectedMarketId, selectMarket } = useUi();
	const [outcome, setOutcome] = useState(3);
	const { send, pending } = useTx();

	const open = markets.filter((market) => !market.resolved);
	const selected =
		markets.find((market) => market.id === selectedMarketId) ??
		open[0] ??
		markets[0];
	const shares = useShareBalances(selected?.id, selected?.prices.length ?? 0);
	const settlementRound = useSettlementRound(selected);

	useEffect(() => {
		if (selected && selectedMarketId === null) selectMarket(selected.id);
	}, [selected, selectedMarketId, selectMarket]);

	const canResolve =
		selected &&
		!selected.resolved &&
		Number(selected.reopenTs) * 1000 <= Date.now() &&
		settlementRound !== undefined;

	return (
		<div className="space-y-6">
			<PricePanel
				active={
					status.activeMarketId !== undefined
						? markets.find((m) => m.id === status.activeMarketId)
						: selected
				}
			/>

			{isLoading ? (
				<Skeleton className="h-80 w-full" />
			) : selected ? (
				<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
					<Card>
						<CardHeader className="flex-row items-start justify-between space-y-0">
							<div className="space-y-1">
								<CardTitle className="text-base font-medium">
									Where does {stock.symbol} reopen?
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									Friday close {usd(selected.refPrice)} - settles on the first
									feed price after the session reopens
								</p>
							</div>
							<div className="flex items-center gap-2">
								{status.activeMarketId === selected.id && !selected.resolved ? (
									<Badge
										variant="outline"
										className="border-amber-500/40 text-amber-600 dark:text-amber-400"
									>
										oracle source
									</Badge>
								) : null}
								<Badge variant="secondary">market #{String(selected.id)}</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<MarketRanges
								market={selected}
								selected={outcome}
								onSelect={setOutcome}
								shares={shares}
							/>
							<SecurityBudget market={selected} />
							<div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
								<span>depth b = {Number(selected.liquidity) / 1e18}</span>
								<span>collateral {usdg(selected.collateralHeld)}</span>
								<span>underwriter fees {usdg(selected.feesAccrued)}</span>
								{selected.resolved ? (
									<span>settled at {usd(selected.settlePrice)}</span>
								) : null}
							</div>
							{canResolve ? (
								<Button
									variant="secondary"
									disabled={Boolean(pending)}
									onClick={() =>
										send("Settle market", {
											address: addresses.gapMarket,
											abi: gapMarketAbi,
											functionName: "resolve",
											args: [selected.id, settlementRound],
										})
									}
								>
									Settle from the reopening price
								</Button>
							) : null}
						</CardContent>
					</Card>

					<div className="space-y-6">
						<TradePanel market={selected} outcome={outcome} shares={shares} />
						{status.isFeedFrozen && open.length === 0 ? (
							<OpenMarketCard />
						) : null}
					</div>
				</div>
			) : status.isFeedFrozen ? (
				<OpenMarketCard />
			) : (
				<Card>
					<CardContent className="flex flex-col items-center gap-3 py-12 text-center">
						<span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
							<CalendarClock className="size-5" />
						</span>
						<h2 className="font-medium">No weekend market yet</h2>
						<p className="max-w-sm text-sm text-muted-foreground">
							{stock.symbol}'s Chainlink feed is live, so there is nothing to
							price. The next market opens when the session closes on Friday at
							20:00 ET.
						</p>
						{nextClose ? (
							<p className="font-mono text-sm tabular-nums">
								opens in <Countdown to={nextClose} />
							</p>
						) : null}
					</CardContent>
				</Card>
			)}

			{markets.length > 1 ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-base font-medium">All markets</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{markets.map((market) => (
							<button
								type="button"
								key={String(market.id)}
								onClick={() => selectMarket(market.id)}
								className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60 ${
									selected?.id === market.id ? "border-primary" : ""
								}`}
							>
								<div className="flex items-center justify-between">
									<span>#{String(market.id)}</span>
									<Badge variant={market.resolved ? "secondary" : "default"}>
										{market.resolved ? "settled" : "live"}
									</Badge>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									close {usd(market.refPrice)} - reopen{" "}
									{new Date(Number(market.reopenTs) * 1000)
										.toUTCString()
										.slice(0, 16)}
								</p>
							</button>
						))}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
