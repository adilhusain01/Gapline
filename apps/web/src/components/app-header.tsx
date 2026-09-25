import {
	robinhoodTestnet,
	STOCK_SYMBOLS,
	type StockSymbol,
} from "@gapline/abi";
import { Link } from "@tanstack/react-router";
import { Loader2, Moon, Sun, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Connector } from "wagmi";
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
		<Badge
			variant="outline"
			className={`hidden gap-1.5 font-medium md:inline-flex ${tone}`}
		>
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

export function ThemeToggle() {
	const { theme, toggleTheme } = useUi();
	return (
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
	);
}

/**
 * Connects an injected wallet. wagmi remembers the last connector in localStorage and reconnects on load, so a
 * refresh keeps the wallet connected; while that runs the button says so instead of offering to connect.
 * With several wallets installed (EIP-6963), it lists them.
 */
export function ConnectButton() {
	const { address, status } = useAccount();
	const { connect, connectors, isPending } = useConnect();
	const { disconnect } = useDisconnect();

	// The generic injected connector duplicates any wallet that announced itself through EIP-6963.
	const wallets =
		connectors.length > 1
			? connectors.filter((c) => c.id !== "injected")
			: connectors;

	function connectTo(connector: Connector) {
		connect(
			{ connector },
			{
				onError: (error) =>
					toast.error("Could not connect", {
						description:
							// Thrown with no injected wallet, though useConnect's error type omits it.
							(error.name as string) === "ProviderNotFoundError"
								? "No browser wallet found. Install one, or open this page in your wallet's browser."
								: error.message.slice(0, 160),
					}),
			},
		);
	}

	if (status === "reconnecting" || status === "connecting" || isPending) {
		return (
			<Button size="sm" variant="outline" disabled>
				<Loader2 className="size-4 animate-spin" />
				{status === "reconnecting" ? "Reconnecting" : "Connecting"}
			</Button>
		);
	}

	if (status === "disconnected") {
		if (wallets.length > 1) {
			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button size="sm">
							<Wallet className="size-4" />
							Connect wallet
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{wallets.map((connector) => (
							<DropdownMenuItem
								key={connector.uid}
								onClick={() => connectTo(connector)}
							>
								{connector.icon ? (
									<img src={connector.icon} alt="" className="size-4" />
								) : (
									<Wallet className="size-4" />
								)}
								{connector.name}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			);
		}
		return (
			<Button
				size="sm"
				disabled={!wallets[0]}
				onClick={() => wallets[0] && connectTo(wallets[0])}
			>
				<Wallet className="size-4" />
				Connect wallet
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

export function Logo() {
	return (
		<Link to="/" className="flex items-center gap-2">
			<span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
				<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
					<path
						d="M1 11 L5 7 L7 9 M9 5 L11 7 L15 3"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</span>
			<span className="text-base font-semibold tracking-tight">Gapline</span>
		</Link>
	);
}

const navLink =
	"rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground";

export function AppHeader() {
	return (
		<header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
			<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
				<Logo />
				<nav className="flex items-center gap-1 text-sm">
					<Link to="/app" activeOptions={{ exact: true }} className={navLink}>
						Market
					</Link>
					<Link to="/app/borrow" className={navLink}>
						Borrow
					</Link>
				</nav>
				<StockPicker />
				<div className="ml-auto flex items-center gap-2">
					<SessionPill />
					<ThemeToggle />
					<ConnectButton />
				</div>
			</div>
		</header>
	);
}
