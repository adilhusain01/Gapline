import { gapMarketAbi } from "@gapline/abi";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { erc20Abi, maxUint256, parseUnits } from "viem";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usdg } from "@/lib/format";
import { addresses, useStock, useWalletState } from "@/lib/gapline";
import { useTx } from "@/lib/useTx";

/** Ranges for the reopening move, in basis points, sized to measured gaps (docs/backtest-TSLA.md, docs/backtest-AMZN.md). */
const EDGES = [-300n, -100n, -25n, 25n, 100n, 300n] as const;
const TAIL_WIDTH_BPS = 200n;

export function OpenMarketCard() {
	const { isConnected } = useAccount();
	const stock = useStock();
	const [depth, setDepth] = useState("10");
	const { send, pending } = useTx();
	const wallet = useWalletState();

	const liquidity = (() => {
		try {
			return parseUnits(depth || "0", 18);
		} catch {
			return 0n;
		}
	})();
	// LMSR subsidy is b * ln(number of ranges).
	const subsidy = BigInt(
		Math.ceil(Number(depth || "0") * Math.log(EDGES.length + 1) * 1e6),
	);
	const needsApproval = wallet.marketAllowance < subsidy;

	async function open() {
		if (needsApproval) {
			const ok = await send("Approve USDG", {
				address: addresses.usdg,
				abi: erc20Abi,
				functionName: "approve",
				args: [addresses.gapMarket, maxUint256],
			});
			if (!ok) return;
		}
		await send(`Open ${stock.symbol} weekend market`, {
			address: addresses.gapMarket,
			abi: gapMarketAbi,
			functionName: "createMarket",
			args: [stock.feed.address, EDGES, liquidity, TAIL_WIDTH_BPS],
		});
	}

	return (
		<Card>
			<CardHeader className="space-y-1">
				<CardTitle className="text-base font-medium">
					Open this weekend's {stock.symbol} market
				</CardTitle>
				<p className="text-sm text-muted-foreground">
					The feed is frozen, so nothing is pricing {stock.symbol} right now.
					Seed a market maker and the oracle has a price again.
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="depth">Depth (b)</Label>
					<Input
						id="depth"
						inputMode="decimal"
						value={depth}
						onChange={(event) => setDepth(event.target.value)}
						className="font-mono"
					/>
					<p className="text-xs text-muted-foreground">
						Higher depth means steadier prices and a larger seed. Seed required:{" "}
						{usdg(subsidy)}.
					</p>
				</div>
				<div className="flex items-baseline justify-between text-sm">
					<span className="text-muted-foreground">Wallet</span>
					<span className="font-mono tabular-nums">
						{usdg(wallet.usdgBalance)}
					</span>
				</div>
				<Button
					className="w-full"
					disabled={!isConnected || liquidity === 0n || Boolean(pending)}
					onClick={open}
				>
					{pending ? <Loader2 className="size-4 animate-spin" /> : null}
					{isConnected
						? needsApproval
							? "Approve and open"
							: "Open market"
						: "Connect wallet"}
				</Button>
			</CardContent>
		</Card>
	);
}
