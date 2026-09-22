import { gapMarketAbi, impliedPriceOracleAbi } from "@gapline/abi";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { erc20Abi, maxUint256, parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rangeLabel, usdg } from "@/lib/format";
import {
	addresses,
	chainId,
	type MarketView,
	useSessionStatus,
	useWalletState,
} from "@/lib/gapline";
import { useTx } from "@/lib/useTx";

const SLIPPAGE_BPS = 200n;

export function TradePanel({
	market,
	outcome,
	shares,
}: {
	market: MarketView;
	outcome: number;
	shares: bigint[];
}) {
	const { isConnected } = useAccount();
	const [side, setSide] = useState<"buy" | "sell">("buy");
	const [amount, setAmount] = useState("5");
	const { send, pending } = useTx();
	const wallet = useWalletState();
	const status = useSessionStatus();

	const size = (() => {
		try {
			return parseUnits(amount || "0", 18);
		} catch {
			return 0n;
		}
	})();

	const quote = useReadContract({
		address: addresses.gapMarket,
		abi: gapMarketAbi,
		chainId,
		functionName: side === "buy" ? "quoteBuy" : "quoteSell",
		args: [market.id, outcome, size],
		query: { enabled: size > 0n && !market.resolved },
	});

	const cost = (quote.data as bigint | undefined) ?? 0n;
	const held = shares[outcome] ?? 0n;
	const tradingClosed =
		market.resolved || Number(market.reopenTs) * 1000 <= Date.now();
	const needsApproval = side === "buy" && wallet.marketAllowance < cost;
	const isActiveSource = status.activeMarketId === market.id;

	async function submit() {
		if (side === "buy") {
			if (needsApproval) {
				const ok = await send("Approve USDG", {
					address: addresses.usdg,
					abi: erc20Abi,
					functionName: "approve",
					args: [addresses.gapMarket, maxUint256],
				});
				if (!ok) return;
			}
			const maxCost = (cost * (10_000n + SLIPPAGE_BPS)) / 10_000n;
			await send(`Buy ${amount} shares`, {
				address: addresses.gapMarket,
				abi: gapMarketAbi,
				functionName: "buy",
				args: [market.id, outcome, size, maxCost],
			});
		} else {
			const minReturn = (cost * (10_000n - SLIPPAGE_BPS)) / 10_000n;
			await send(`Sell ${amount} shares`, {
				address: addresses.gapMarket,
				abi: gapMarketAbi,
				functionName: "sell",
				args: [market.id, outcome, size, minReturn],
			});
		}
	}

	return (
		<Card>
			<CardHeader className="space-y-1">
				<CardTitle className="text-base font-medium">
					{market.resolved
						? "Market settled"
						: tradingClosed
							? "Trading closed"
							: "Trade this range"}
				</CardTitle>
				<p className="text-sm text-muted-foreground">
					{rangeLabel(market.edges, outcome)}
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{market.resolved ? (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Every winning share redeems for 1 USDG. Losing shares expire
							worthless.
						</p>
						<Button
							className="w-full"
							disabled={!isConnected || Boolean(pending)}
							onClick={() =>
								send("Redeem winnings", {
									address: addresses.gapMarket,
									abi: gapMarketAbi,
									functionName: "redeem",
									args: [market.id],
								})
							}
						>
							{pending ? <Loader2 className="size-4 animate-spin" /> : null}
							Redeem
						</Button>
					</div>
				) : (
					<>
						<Tabs
							value={side}
							onValueChange={(value) => setSide(value as "buy" | "sell")}
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="buy">Buy</TabsTrigger>
								<TabsTrigger value="sell">Sell</TabsTrigger>
							</TabsList>
						</Tabs>

						<div className="space-y-2">
							<Label htmlFor="size">Shares</Label>
							<Input
								id="size"
								inputMode="decimal"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								className="font-mono"
							/>
							<p className="text-xs text-muted-foreground">
								You hold {Number(held) / 1e18 || 0} shares in this range.
							</p>
						</div>

						<Separator />

						<div className="flex items-baseline justify-between text-sm">
							<span className="text-muted-foreground">
								{side === "buy" ? "Cost" : "You receive"}
							</span>
							<span className="font-mono tabular-nums">
								{quote.isLoading ? "..." : usdg(cost)}
							</span>
						</div>
						<div className="flex items-baseline justify-between text-sm">
							<span className="text-muted-foreground">Wallet</span>
							<span className="font-mono tabular-nums">
								{usdg(wallet.usdgBalance)}
							</span>
						</div>

						<Button
							className="w-full"
							disabled={
								!isConnected || tradingClosed || size === 0n || Boolean(pending)
							}
							onClick={submit}
						>
							{pending ? <Loader2 className="size-4 animate-spin" /> : null}
							{!isConnected
								? "Connect wallet"
								: tradingClosed
									? "Trading closed"
									: needsApproval
										? "Approve and buy"
										: side === "buy"
											? "Buy shares"
											: "Sell shares"}
						</Button>
					</>
				)}

				{!isActiveSource && !market.resolved ? (
					<Button
						variant="outline"
						className="w-full"
						disabled={Boolean(pending)}
						onClick={() =>
							send("Use as oracle source", {
								address: addresses.oracle,
								abi: impliedPriceOracleAbi,
								functionName: "setActiveMarket",
								args: [market.id],
							})
						}
					>
						Make this the oracle's price source
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
