import { gapGuardedLendingPoolAbi } from "@gapline/abi";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { erc20Abi, formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount } from "wagmi";

import { ProtectLoanCard } from "@/components/protect-loan-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { usd, usdg } from "@/lib/format";
import {
	addresses,
	useMarkets,
	usePosition,
	useSessionStatus,
	useStock,
	useWalletState,
} from "@/lib/gapline";
import { useTx } from "@/lib/useTx";

/**
 * Demo limit on each wallet's debt in each pool (TSLA and AMZN each hold ~110 USDG). The contract allows up to
 * 50% loan-to-value; the app caps borrowing here so a few testers cannot drain a pool.
 */
const BORROW_CAP = parseUnits("5", 6);

function Row({
	label,
	value,
	muted,
}: {
	label: string;
	value: string;
	muted?: boolean;
}) {
	return (
		<div className="flex items-baseline justify-between text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span
				className={`font-mono tabular-nums ${muted ? "text-muted-foreground" : ""}`}
			>
				{value}
			</span>
		</div>
	);
}

/** Borrow dashboard for the selected stock; shared by /app and /demo. */
export function BorrowPage() {
	const { address, isConnected } = useAccount();
	const position = usePosition();
	const wallet = useWalletState();
	const status = useSessionStatus();
	const { markets } = useMarkets();
	const activeMarket = markets.find((m) => m.id === status.activeMarketId);
	const { send, pending } = useTx();
	const stock = useStock();
	const [collateral, setCollateral] = useState("1");
	const [borrow, setBorrow] = useState("5");

	const collateralAmount = (() => {
		try {
			return parseUnits(collateral || "0", 18);
		} catch {
			return 0n;
		}
	})();
	const borrowAmount = (() => {
		try {
			return parseUnits(borrow || "0", 6);
		} catch {
			return 0n;
		}
	})();

	const implied = status.band?.implied ?? false;
	const paused = position.pricingPaused;

	// What a borrow can actually get: the contract's limit, the demo cap and the pool's cash, whichever is least.
	const capLeft =
		BORROW_CAP > (position.debt ?? 0n)
			? BORROW_CAP - (position.debt ?? 0n)
			: 0n;
	const limits = [
		position.maxBorrow ?? 0n,
		capLeft,
		position.poolReserves ?? 0n,
	];
	const borrowable = limits.reduce((a, b) => (b < a ? b : a));
	const borrowBlocked =
		!isConnected || paused || borrowAmount <= borrowable
			? undefined
			: borrowAmount > capLeft
				? `Over the demo limit: you can borrow ${usdg(capLeft)} more in this pool.`
				: borrowAmount > (position.poolReserves ?? 0n)
					? `The pool has ${usdg(position.poolReserves)} to lend right now.`
					: `Over your borrowing power: deposit more ${stock.symbol} first.`;

	async function deposit() {
		if (wallet.stockAllowance < collateralAmount) {
			const ok = await send(`Approve ${stock.symbol}`, {
				address: stock.token,
				abi: erc20Abi,
				functionName: "approve",
				args: [stock.pool.address, maxUint256],
			});
			if (!ok) return;
		}
		await send(`Deposit ${collateral} ${stock.symbol}`, {
			address: stock.pool.address,
			abi: gapGuardedLendingPoolAbi,
			functionName: "deposit",
			args: [collateralAmount],
		});
	}

	async function repay() {
		if (wallet.poolAllowance < borrowAmount) {
			const ok = await send("Approve USDG", {
				address: addresses.usdg,
				abi: erc20Abi,
				functionName: "approve",
				args: [stock.pool.address, maxUint256],
			});
			if (!ok) return;
		}
		await send(`Repay ${borrow} USDG`, {
			address: stock.pool.address,
			abi: gapGuardedLendingPoolAbi,
			functionName: "repay",
			args: [address ?? "0x0", borrowAmount],
		});
	}

	return (
		<div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
			<Card>
				<CardHeader className="space-y-1">
					<CardTitle className="text-base font-medium">
						Borrow USDG against {stock.symbol}
					</CardTitle>
					<p className="text-sm text-muted-foreground">
						A demo pool that prices collateral through the gap oracle. While the
						feed is frozen it values new borrowing at the low end of the band
						and only liquidates if you are underwater at the high end.
					</p>
				</CardHeader>
				<CardContent className="space-y-4">
					<div
						className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
							paused
								? "border-destructive/30 bg-destructive/5 text-destructive"
								: implied
									? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
									: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
						}`}
					>
						{paused ? (
							<ShieldAlert className="mt-0.5 size-4 shrink-0" />
						) : (
							<ShieldCheck className="mt-0.5 size-4 shrink-0" />
						)}
						<div>
							<p className="font-medium">
								{paused
									? "Pricing paused"
									: implied
										? "Weekend pricing from the gap market"
										: "Live feed pricing"}
							</p>
							<p className="text-muted-foreground">
								{paused
									? "The feed is frozen and no market is pricing it, so borrowing and liquidations are both disabled."
									: implied
										? `Borrowing at ${usd(position.riskPrice)}, liquidation at ${usd(position.liquidationPrice)}.`
										: `Both sides use the live price ${usd(position.riskPrice)}.`}
							</p>
						</div>
					</div>

					<Separator />

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="collateral">Deposit {stock.symbol}</Label>
							<Input
								id="collateral"
								inputMode="decimal"
								value={collateral}
								onChange={(event) => setCollateral(event.target.value)}
								className="font-mono"
							/>
							<p className="text-xs text-muted-foreground">
								Wallet{" "}
								{wallet.stockBalance !== undefined
									? Number(formatUnits(wallet.stockBalance, 18)).toFixed(2)
									: "--"}{" "}
								{stock.symbol}
							</p>
							<Button
								className="w-full"
								disabled={!isConnected || Boolean(pending)}
								onClick={deposit}
							>
								{pending ? <Loader2 className="size-4 animate-spin" /> : null}
								Deposit
							</Button>
						</div>

						<div className="space-y-2">
							<Label htmlFor="borrow">Borrow USDG</Label>
							<Input
								id="borrow"
								inputMode="decimal"
								value={borrow}
								onChange={(event) => setBorrow(event.target.value)}
								className="font-mono"
							/>
							<div className="space-y-0.5 text-xs text-muted-foreground">
								<p>
									Borrowing power {paused ? "paused" : usdg(position.maxBorrow)}
								</p>
								<p>
									You can borrow {paused ? "--" : usdg(borrowable)} (demo limit{" "}
									{usdg(BORROW_CAP, 0)} per wallet)
								</p>
								{borrowBlocked ? (
									<p className="text-destructive">{borrowBlocked}</p>
								) : null}
							</div>
							<div className="flex gap-2">
								<Button
									className="flex-1"
									disabled={
										!isConnected ||
										paused ||
										Boolean(pending) ||
										borrowAmount === 0n ||
										Boolean(borrowBlocked)
									}
									onClick={() =>
										send(`Borrow ${borrow} USDG`, {
											address: stock.pool.address,
											abi: gapGuardedLendingPoolAbi,
											functionName: "borrow",
											args: [borrowAmount],
										})
									}
								>
									Borrow
								</Button>
								<Button
									variant="outline"
									className="flex-1"
									disabled={!isConnected || Boolean(pending)}
									onClick={repay}
								>
									Repay
								</Button>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base font-medium">
							Your position
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<Row
							label="Collateral"
							value={
								position.collateral !== undefined
									? `${Number(formatUnits(position.collateral, 18)).toFixed(2)} ${stock.symbol}`
									: "--"
							}
						/>
						<Row label="Debt" value={usdg(position.debt)} />
						<Row
							label="Borrow price"
							value={paused ? "paused" : usd(position.riskPrice)}
							muted
						/>
						<Row
							label="Liquidation price"
							value={paused ? "paused" : usd(position.liquidationPrice)}
							muted
						/>
						<Separator />
						<Row
							label="Status"
							value={
								!isConnected
									? "--"
									: paused
										? "paused"
										: position.isLiquidatable
											? "liquidatable"
											: "healthy"
							}
						/>
						<p className="text-xs text-muted-foreground">
							Max loan-to-value 50%, liquidation at 70%, 5% liquidation bonus.
						</p>
					</CardContent>
				</Card>
				<ProtectLoanCard market={activeMarket} debt={position.debt} />
			</div>
		</div>
	);
}
