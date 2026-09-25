import {
	robinhoodTestnet,
	STOCK_SYMBOLS,
	type StockSymbol,
} from "@gapline/abi";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Logo, ThemeToggle } from "@/components/app-header";
import { Countdown } from "@/components/live-time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekendChart } from "@/components/weekend-chart";
import { usd } from "@/lib/format";
import {
	addresses,
	useNextClose,
	useSessionStatus,
	useStock,
} from "@/lib/gapline";
import { useUi } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Landing });

function LandingHeader() {
	return (
		<header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
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
					<Button size="sm" asChild>
						<Link to="/app">Open app</Link>
					</Button>
				</div>
			</div>
		</header>
	);
}

/** One stock right now: the live feed price, or the weekend market's price and range. Opens it in the app. */
function LiveStock({ symbol }: { symbol: StockSymbol }) {
	const status = useSessionStatus(symbol);
	const { name } = useStock(symbol);
	const selectStock = useUi((state) => state.selectStock);

	if (status.isOpen === undefined) return <Skeleton className="h-14 w-full" />;

	const implied = status.band?.implied ?? false;
	const state = implied
		? { label: "priced by the weekend market", tone: "text-band" }
		: status.isFeedFrozen
			? { label: "feed frozen, no market yet", tone: "text-destructive" }
			: {
					label: "live Chainlink feed",
					tone: "text-emerald-600 dark:text-emerald-400",
				};

	return (
		<Link
			to="/app"
			onClick={() => selectStock(symbol)}
			className="group flex items-baseline justify-between gap-4 py-3 sm:px-6"
		>
			<div>
				<p className="font-medium group-hover:underline">
					{symbol}{" "}
					<span className="font-normal text-muted-foreground">{name}</span>
				</p>
				<p className={`text-xs ${state.tone}`}>{state.label}</p>
			</div>
			<div className="text-right">
				<p className="font-mono text-xl tabular-nums">
					{usd(status.band?.mid)}
				</p>
				{implied ? (
					<p className="font-mono text-xs text-muted-foreground tabular-nums">
						{usd(status.band?.low)} to {usd(status.band?.high)}
					</p>
				) : null}
			</div>
		</Link>
	);
}

function LiveStrip() {
	const status = useSessionStatus(STOCK_SYMBOLS[0]);
	const nextClose = useNextClose();
	return (
		<div className="grid border-y sm:grid-cols-[1fr_1fr_auto] sm:divide-x">
			{STOCK_SYMBOLS.map((symbol) => (
				<LiveStock key={symbol} symbol={symbol} />
			))}
			<p className="flex items-center py-3 text-sm text-muted-foreground sm:px-6">
				{status.isOpen === undefined ? null : status.isOpen ? (
					<span>
						Feeds freeze in{" "}
						<span className="font-mono text-foreground tabular-nums">
							{nextClose ? <Countdown to={nextClose} /> : "--"}
						</span>
					</span>
				) : (
					<span>
						Feeds restart in{" "}
						<span className="font-mono text-foreground tabular-nums">
							<Countdown to={status.nextOpen ?? 0n} />
						</span>
					</span>
				)}
			</p>
		</div>
	);
}

const steps = [
	{
		when: "Friday, 20:00 ET",
		title: "The feed stops",
		body: "Chainlink stops updating at the close. Gapline opens a market on where the stock reopens, split into seven price ranges.",
	},
	{
		when: "Saturday and Sunday",
		title: "People trade the ranges",
		body: "Buying a range costs USDG and raises its odds. A pricing agent trades too, using Uniswap and Bitcoin moves.",
	},
	{
		when: "Every block",
		title: "The oracle reads the market",
		body: "The odds become a price and a range, published through the same interface lenders already read from Chainlink.",
	},
	{
		when: "Sunday, 20:00 ET",
		title: "The market settles",
		body: "The first Chainlink price after the reopen picks the winning range. Each winning share pays 1 USDG.",
	},
];

const lenderTerms = [
	{
		term: "New loans",
		detail: "are valued at the low end of the range.",
	},
	{
		term: "Liquidations",
		detail:
			"happen only when a loan is underwater at the high end, so one thin weekend trade cannot trigger them.",
	},
	{
		term: "Gap cover",
		detail:
			"pays borrowers if the stock reopens 3% or more lower. The demo pool also covers its own loans each weekend.",
	},
];

function Landing() {
	return (
		<>
			<LandingHeader />
			<main className="flex-1">
				<section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:pt-20">
					<h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl">
						Weekend prices for tokenized stocks
					</h1>
					<p className="mt-5 max-w-xl text-lg text-muted-foreground">
						Chainlink's TSLA and AMZN feeds stop from Friday evening to Sunday
						evening while the tokens keep trading. Gapline runs a market on
						where each stock reopens and turns it into a price and a range
						lenders can use.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Button size="lg" asChild>
							<Link to="/app">Open the app</Link>
						</Button>
						<Button size="lg" variant="outline" asChild>
							{/* A full page load: /demo connects to the demo chain, chosen at load. */}
							<a href="/demo">Try a demo weekend</a>
						</Button>
					</div>

					<div className="mt-14">
						<WeekendChart />
					</div>
					<div className="mt-8">
						<LiveStrip />
					</div>
				</section>

				<section
					id="how"
					className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16"
				>
					<h2 className="text-2xl font-semibold tracking-tight">
						How a weekend runs
					</h2>
					<ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
						{steps.map((step) => (
							<li key={step.title} className="border-t-2 border-band/60 pt-4">
								<p className="text-sm text-band">{step.when}</p>
								<h3 className="mt-2 font-medium">{step.title}</h3>
								<p className="mt-1.5 text-sm text-muted-foreground">
									{step.body}
								</p>
							</li>
						))}
					</ol>
				</section>

				<section
					id="lenders"
					className="mx-auto grid w-full max-w-6xl scroll-mt-20 gap-8 px-4 py-16 lg:grid-cols-[1fr_2fr]"
				>
					<div>
						<h2 className="text-2xl font-semibold tracking-tight">
							For lenders
						</h2>
						<p className="mt-2 max-w-sm text-muted-foreground">
							A demo lending pool reads the range instead of the frozen feed.
						</p>
					</div>
					<dl className="divide-y border-y">
						{lenderTerms.map((item) => (
							<div
								key={item.term}
								className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]"
							>
								<dt className="font-medium">{item.term}</dt>
								<dd className="text-muted-foreground">{item.detail}</dd>
							</div>
						))}
					</dl>
				</section>

				<section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 pt-6 pb-20 sm:flex-row sm:items-center sm:justify-between">
					<p className="max-w-lg text-lg">
						Trade the reopen, or borrow USDG against TSLA and AMZN on Robinhood
						Chain testnet.
					</p>
					<Button size="lg" asChild>
						<Link to="/app">Open the app</Link>
					</Button>
				</section>
			</main>

			<footer className="border-t">
				<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground">
					<span>Built for Arbitrum Open House Singapore.</span>
					<a
						className="hover:text-foreground"
						href={`${robinhoodTestnet.blockExplorers.default.url}/address/${addresses.gapMarket}`}
						target="_blank"
						rel="noreferrer"
					>
						GapMarket on the explorer
					</a>
				</div>
			</footer>
		</>
	);
}
