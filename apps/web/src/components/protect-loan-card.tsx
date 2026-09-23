import { gapMarketAbi } from "@gapline/abi";
import { Loader2, Umbrella } from "lucide-react";
import { useState } from "react";
import { erc20Abi, maxUint256 } from "viem";
import { useAccount, useReadContract } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rangeLabel, usdg } from "@/lib/format";
import {
	addresses,
	chainId,
	type MarketView,
	usePoolHedge,
	useStock,
	useWalletState,
} from "@/lib/gapline";
import { useTx } from "@/lib/useTx";

const CRASH_RANGE = 0;
const LEVELS = ["10", "25", "50"] as const;

/**
 * Gap cover in lender terms: buy shares of the worst reopening range sized to a share of your debt, so a
 * crash at the reopen pays you that amount in USDG. Also shows the pool's own weekly cover.
 */
export function ProtectLoanCard({
	market,
	debt,
}: {
	market: MarketView | undefined;
	debt: bigint | undefined;
}) {
	const { isConnected } = useAccount();
	const [level, setLevel] = useState<(typeof LEVELS)[number]>("25");
	const { send, pending } = useTx();
	const wallet = useWalletState();
	const poolHedge = usePoolHedge(market?.id);
	const stock = useStock();

	const payout = ((debt ?? 0n) * BigInt(level)) / 100n; // USDG units
	const shares = payout * 10n ** 12n; // each winning share pays 1 USDG
	const tradable =
		market && !market.resolved && Number(market.reopenTs) * 1000 > Date.now();

	const quote = useReadContract({
		address: addresses.gapMarket,
		abi: gapMarketAbi,
		chainId,
		functionName: "quoteBuy",
		args: [market?.id ?? 0n, CRASH_RANGE, shares],
		query: { enabled: Boolean(tradable) && shares > 0n },
	});
	const premium = (quote.data as bigint | undefined) ?? 0n;

	async function protect() {
		if (!market) return;
		if (wallet.marketAllowance < premium) {
			const ok = await send("Approve USDG", {
				address: addresses.usdg,
				abi: erc20Abi,
				functionName: "approve",
				args: [addresses.gapMarket, maxUint256],
			});
			if (!ok) return;
		}
		await send(`Buy ${usdg(payout)} of gap cover`, {
			address: addresses.gapMarket,
			abi: gapMarketAbi,
			functionName: "buy",
			args: [market.id, CRASH_RANGE, shares, (premium * 102n) / 100n],
		});
	}

	return (
		<Card>
			<CardHeader className="space-y-1">
				<CardTitle className="flex items-center gap-2 text-base font-medium">
					<Umbrella className="size-4" />
					Protect my loan
				</CardTitle>
				<p className="text-sm text-muted-foreground">
					{market
						? `Pays out if ${stock.symbol} reopens ${rangeLabel(market.edges, CRASH_RANGE)} versus Friday's close.`
						: "Cover opens with the weekend market, when the session closes on Friday."}
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{tradable ? (
					<>
						<Tabs
							value={level}
							onValueChange={(value) =>
								setLevel(value as (typeof LEVELS)[number])
							}
						>
							<TabsList className="grid w-full grid-cols-3">
								{LEVELS.map((l) => (
									<TabsTrigger key={l} value={l}>
										{l}% of debt
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
						<div className="space-y-1.5 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									Pays if it crashes
								</span>
								<span className="font-mono tabular-nums">{usdg(payout)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Premium now</span>
								<span className="font-mono tabular-nums">
									{quote.isLoading ? "..." : usdg(premium)}
								</span>
							</div>
						</div>
						<Button
							className="w-full"
							disabled={!isConnected || payout === 0n || Boolean(pending)}
							onClick={protect}
						>
							{pending ? <Loader2 className="size-4 animate-spin" /> : null}
							{!isConnected
								? "Connect wallet"
								: payout === 0n
									? "Borrow first to size cover"
									: "Buy cover"}
						</Button>
					</>
				) : null}

				<Separator />
				<div className="space-y-1.5 text-sm">
					<p className="font-medium">The pool's own cover this weekend</p>
					{poolHedge.shares > 0n ? (
						<p className="text-muted-foreground">
							Pays {usdg(poolHedge.shares / 10n ** 12n)} on a crash, bought for{" "}
							{usdg(poolHedge.premium)} (at most 1% of the pool's{" "}
							{usdg(poolHedge.totalDebt)} of loans).
						</p>
					) : (
						<p className="text-muted-foreground">
							Not bought yet. The keeper buys it once the weekend market opens,
							sized to 10% of outstanding loans.
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
