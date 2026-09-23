import {
	robinhoodTestnet,
	STOCK_SYMBOLS,
	type StockSymbol,
} from "@gapline/abi";
import { Link } from "@tanstack/react-router";
import { Moon, Sun, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shortAddress } from "@/lib/format";
import { useSessionStatus } from "@/lib/gapline";
import { useUi } from "@/lib/store";

function SessionPill() {
	const { isOpen, isFeedFrozen, band } = useSessionStatus();
	if (isOpen === undefined) return null;
	const implied = band?.implied;
	const label = isOpen ? "Market open" : "Market closed";
	const tone = implied
		? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
		: isFeedFrozen
			? "border-destructive/40 bg-destructive/10 text-destructive"
			: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
	return (
		<Badge variant="outline" className={`gap-1.5 font-medium ${tone}`}>
			<span className="size-1.5 rounded-full bg-current" />
			{implied ? "Gap-implied price" : isFeedFrozen ? "Feed frozen" : label}
		</Badge>
	);
}

/** Picks the stock every page shows; each has its own feed, market, oracle and lending pool. */
function StockPicker() {
	const { stock, selectStock } = useUi();
	return (
		<Tabs
			value={stock}
			onValueChange={(value) => selectStock(value as StockSymbol)}
		>
			<TabsList aria-label="Stock">
				{STOCK_SYMBOLS.map((symbol) => (
					<TabsTrigger key={symbol} value={symbol} className="font-mono">
						{symbol}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}

function ConnectButton() {
	const { address, isConnected } = useAccount();
	const { connect, connectors, isPending } = useConnect();
	const { disconnect } = useDisconnect();

	if (!isConnected) {
		const connector = connectors[0];
		return (
			<Button
				size="sm"
				disabled={isPending || !connector}
				onClick={() => connector && connect({ connector })}
			>
				<Wallet className="size-4" />
				{isPending ? "Connecting" : "Connect wallet"}
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="sm" variant="outline" className="font-mono">
					{shortAddress(address)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					onClick={() =>
						window.open(
							`${robinhoodTestnet.blockExplorers.default.url}/address/${address}`,
							"_blank",
						)
					}
				>
					View on explorer
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => disconnect()}>
					Disconnect
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function AppHeader() {
	const { theme, toggleTheme } = useUi();
	return (
		<header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
			<div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
				<Link to="/" className="flex items-baseline gap-2">
					<span className="text-base font-semibold tracking-tight">
						Gapline
					</span>
					<span className="hidden text-xs text-muted-foreground sm:inline">
						weekend price for tokenized stocks
					</span>
				</Link>
				<nav className="ml-2 flex items-center gap-1 text-sm">
					<Link
						to="/"
						className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
					>
						Market
					</Link>
					<Link
						to="/lend"
						className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
					>
						Borrow
					</Link>
				</nav>
				<StockPicker />
				<div className="ml-auto flex items-center gap-2">
					<SessionPill />
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleTheme}
						aria-label="Toggle theme"
					>
						{theme === "dark" ? (
							<Sun className="size-4" />
						) : (
							<Moon className="size-4" />
						)}
					</Button>
					<ConnectButton />
				</div>
			</div>
		</header>
	);
}
