import { STOCK_SYMBOLS, type StockSymbol } from "@gapline/abi";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CalendarClock,
	ChartNoAxesColumn,
	CircleCheck,
	Gauge,
	Scale,
	ShieldCheck,
	Umbrella,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { ConnectButton, Logo, ThemeToggle } from "@/components/app-header";
import { Countdown } from "@/components/live-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usd } from "@/lib/format";
import { useNextClose, useSessionStatus, useStock } from "@/lib/gapline";
import { useUi } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Landing });

function LaunchButton({ size = "lg" }: { size?: "sm" | "lg" }) {
	return (
		<Button size={size} asChild>
			<Link to="/app">
				Launch app
				<ArrowRight className="size-4" />
			</Link>
		</Button>
	);
}

function LandingHeader() {
	return (
		<header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
			<div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
				<Logo />
				<nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
					<a
						href="#how"
						className="rounded-md px-2.5 py-1.5 hover:text-foreground"
					>
						How it works
					</a>
					<a
						href="#lenders"
						className="rounded-md px-2.5 py-1.5 hover:text-foreground"
					>
						For lenders
					</a>
				</nav>
				<div className="ml-auto flex items-center gap-2">
					<ThemeToggle />
					<div className="hidden sm:block">
						<ConnectButton />
					</div>
					<LaunchButton size="sm" />
				</div>
			</div>
		</header>
	);
}

/** One stock's live state: feed price, or the weekend market's implied price and band. */
function StockRow({ symbol }: { symbol: StockSymbol }) {
	const status = useSessionStatus(symbol);
	const { name } = useStock(symbol);
	const selectStock = useUi((state) => state.selectStock);

	if (status.isOpen === undefined) return <Skeleton className="h-16 w-full" />;

	const implied = status.band?.implied ?? false;
	const state = implied
		? {
				label: "Weekend market",
				tone: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
			}
		: status.isFeedFrozen
			? {
					label: "Feed frozen",
					tone: "border-destructive/40 bg-destructive/10 text-destructive",
				}
			: {
					label: "Live feed",
					tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
				};

	return (
		<Link
			to="/app"
			onClick={() => selectStock(symbol)}
			className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60"
		>
			<div className="min-w-0">
				<p className="font-mono text-sm font-medium">{symbol}</p>
				<p className="truncate text-xs text-muted-foreground">{name}</p>
			</div>
			<div className="text-right">
				<p className="font-mono text-lg tabular-nums">
					{usd(status.band?.mid)}
				</p>
				<p className="font-mono text-xs text-muted-foreground tabular-nums">
					{implied
						? `${usd(status.band?.low)} - ${usd(status.band?.high)}`
						: "\u00a0"}
				</p>
			</div>
			<Badge
				variant="outline"
				className={`w-28 shrink-0 justify-center gap-1.5 ${state.tone}`}
			>
				<span className="size-1.5 rounded-full bg-current" />
				{state.label}
			</Badge>
		</Link>
	);
}

function LiveCard() {
	const status = useSessionStatus(STOCK_SYMBOLS[0]);
	const nextClose = useNextClose();
	return (
		<Card className="shadow-xl shadow-primary/5">
			<CardContent className="space-y-1 p-2">
				<div className="flex items-center justify-between px-3 pt-2 pb-1 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<span className="relative flex size-2">
							<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
							<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
						</span>
						Live from Robinhood Chain
					</span>
					<span className="font-mono tabular-nums">
						{status.isOpen === undefined ? null : status.isOpen ? (
							<>closes in {nextClose ? <Countdown to={nextClose} /> : "--"}</>
						) : (
							<>
								reopens in <Countdown to={status.nextOpen ?? 0n} />
							</>
						)}
					</span>
				</div>
				{STOCK_SYMBOLS.map((symbol) => (
					<StockRow key={symbol} symbol={symbol} />
				))}
			</CardContent>
		</Card>
	);
}

function Section({
	id,
	title,
	subtitle,
	children,
}: {
	id?: string;
	title: string;
	subtitle: string;
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16"
		>
			<div className="mb-8 max-w-xl space-y-2">
				<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
				<p className="text-muted-foreground">{subtitle}</p>
			</div>
			{children}
		</section>
	);
}

const problem = [
	["52-78 h", "Chainlink stock feeds sit frozen every weekend"],
	["24/7", "Tokenized stocks keep trading on-chain"],
	["0.8%", "Typical TSLA weekend gap, invisible to lenders"],
] as const;

type Step = {
	icon: ComponentType<{ className?: string }>;
	when: string;
	title: string;
	body: string;
};

const steps: Step[] = [
	{
		icon: CalendarClock,
		when: "Friday 20:00 ET",
		title: "A market opens",
		body: "The feed freezes. A market opens on where the stock reopens, split into seven ranges.",
	},
	{
		icon: ChartNoAxesColumn,
		when: "All weekend",
		title: "Traders price it",
		body: "Anyone buys the ranges they believe in with USDG. Odds come from an LMSR on Arbitrum Stylus.",
	},
	{
		icon: Gauge,
		when: "Every block",
		title: "The oracle publishes",
		body: "The odds become a price and a confidence band, behind Chainlink's standard interface.",
	},
	{
		icon: CircleCheck,
		when: "Sunday 20:00 ET",
		title: "It settles",
		body: "The first Chainlink price after the reopen settles the market. Winning shares pay 1 USDG.",
	},
];

const lenderCards: Omit<Step, "when">[] = [
	{
		icon: ShieldCheck,
		title: "Borrow at the low end",
		body: "New loans are valued at the bottom of the band, so a rosy weekend can't inflate them.",
	},
	{
		icon: Scale,
		title: "Liquidate at the high end",
		body: "Positions are only liquidated when underwater at the top of the band. No thin-print liquidations.",
	},
	{
		icon: Umbrella,
		title: "Insure the gap",
		body: "Buy cover against a crash at the reopen, sized to your loan. The pool covers itself too.",
	},
];

const stack = ["Robinhood Chain", "Chainlink", "Arbitrum Stylus", "Paxos USDG"];

function Landing() {
	const tsla = useSessionStatus(STOCK_SYMBOLS[0]);
	const weekendLive = tsla.band?.implied ?? false;

	return (
		<>
			<LandingHeader />
			<main className="flex-1">
				<section className="relative overflow-hidden border-b">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:48px_48px] opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_30%_20%,black,transparent)]"
					/>
					<div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24">
						<div className="space-y-6">
							<Badge variant="outline" className="gap-1.5">
								<span className="size-1.5 rounded-full bg-emerald-500" />
								Live on Robinhood Chain testnet
							</Badge>
							<h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
								Stocks close for the weekend.{" "}
								<span className="text-muted-foreground">
									Their price shouldn't.
								</span>
							</h1>
							<p className="max-w-md text-lg text-muted-foreground">
								Gapline prices the weekend gap in tokenized stocks, so lenders
								always have a price they can trust.
							</p>
							<div className="flex flex-wrap gap-3">
								<LaunchButton />
								<Button size="lg" variant="outline" asChild>
									<a href="#how">How it works</a>
								</Button>
							</div>
						</div>
						<LiveCard />
					</div>
				</section>

				<Section
					title="The weekend blind spot"
					subtitle="On-chain stocks never stop trading. Their oracles do."
				>
					<div className="grid gap-4 sm:grid-cols-3">
						{problem.map(([stat, label]) => (
							<Card key={stat}>
								<CardContent className="space-y-1 p-6">
									<p className="text-3xl font-semibold tracking-tight tabular-nums">
										{stat}
									</p>
									<p className="text-sm text-muted-foreground">{label}</p>
								</CardContent>
							</Card>
						))}
					</div>
				</Section>

				<Section
					id="how"
					title="How it works"
					subtitle="A market on Monday's open turns into a live weekend price."
				>
					<ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{steps.map((step, index) => (
							<li key={step.title}>
								<Card className="h-full">
									<CardContent className="space-y-4 p-6">
										<div className="flex items-center justify-between">
											<span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
												<step.icon className="size-4.5" />
											</span>
											<span className="font-mono text-xs text-muted-foreground">
												0{index + 1}
											</span>
										</div>
										<div className="space-y-1.5">
											<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
												{step.when}
											</p>
											<h3 className="font-medium">{step.title}</h3>
											<p className="text-sm text-muted-foreground">
												{step.body}
											</p>
										</div>
									</CardContent>
								</Card>
							</li>
						))}
					</ol>
				</Section>

				<Section
					id="lenders"
					title="Built for lenders"
					subtitle="A demo lending pool reads the band instead of a frozen feed."
				>
					<div className="grid gap-4 sm:grid-cols-3">
						{lenderCards.map((card) => (
							<Card key={card.title}>
								<CardContent className="space-y-3 p-6">
									<card.icon className="size-5 text-primary" />
									<h3 className="font-medium">{card.title}</h3>
									<p className="text-sm text-muted-foreground">{card.body}</p>
								</CardContent>
							</Card>
						))}
					</div>
				</Section>

				<section className="mx-auto w-full max-w-6xl px-4 pb-20">
					<Card className="bg-muted/40">
						<CardContent className="flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
							<div className="space-y-1">
								<h2 className="text-xl font-semibold tracking-tight">
									{weekendLive
										? "This weekend's market is live."
										: "The next market opens Friday at 20:00 ET."}
								</h2>
								<p className="text-sm text-muted-foreground">
									Trade the reopen, or borrow against TSLA and AMZN.
								</p>
							</div>
							<LaunchButton />
						</CardContent>
					</Card>
				</section>
			</main>

			<footer className="border-t">
				<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground">
					<span>Gapline - built for Arbitrum Open House Singapore</span>
					<span className="flex flex-wrap gap-x-4 gap-y-1">
						{stack.map((name) => (
							<span key={name}>{name}</span>
						))}
					</span>
				</div>
			</footer>
		</>
	);
}
