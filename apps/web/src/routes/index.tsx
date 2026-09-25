import {
	robinhoodTestnet,
	STOCK_SYMBOLS,
	type StockSymbol,
} from "@gapline/abi";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Logo, ThemeToggle } from "@/components/app-header";
import { ArchitectureDiagram } from "@/components/explainer/architecture-diagram";
import { Walkthrough } from "@/components/explainer/walkthrough";
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
					{[
						["#how", "How it works"],
						["#system", "What runs it"],
						["#trust", "Why trust it"],
					].map(([href, label]) => (
						<a
							key={href}
							href={href}
							className="rounded-md px-2.5 py-1.5 hover:text-foreground"
						>
							{label}
						</a>
					))}
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

/** Each piece in one line, in the order the diagram reads. */
const components = [
	[
		"MarketCalendar",
		"Knows when NYSE is open, including holidays and daylight-saving changes.",
	],
	[
		"GapMarket",
		"The market on where the stock reopens. Holds the USDG and pays the winners.",
	],
	[
		"LmsrMath",
		"Prices every trade. A Rust program on Arbitrum Stylus that matches the Solidity reference on 240 of 240 markets tested on-chain.",
	],
	[
		"ImpliedPriceOracle",
		"Turns the odds into a price and a range behind Chainlink's standard interface, and passes the live price through on weekdays.",
	],
	[
		"Lending pool",
		"A demo pool that lends USDG against TSLA and AMZN using the range, and insures itself each weekend.",
	],
	[
		"Agent",
		"Opens each weekend's markets, trades toward its forecast, buys the pool's cover, then settles and collects.",
	],
	[
		"Relayer",
		"Copies Chainlink's mainnet stock prices to the testnet with their original timestamps. On mainnet the contracts read Chainlink directly.",
	],
] as const;

const safeguards = [
	[
		"Moving the price costs money",
		"Shifting the implied price means buying ranges from the market maker at rising prices. The oracle ignores markets below a minimum depth and only switches to a deeper one.",
	],
	[
		"Settlement can't be cherry-picked",
		"Only the first Chainlink price at or after the reopen settles a market; the contract checks the price before it was still from the weekend.",
	],
	[
		"The forecast is tested",
		"Over TSLA's 13 past weekends, the agent's forecast missed the reopen by 0.39 points on average, against 0.67 for assuming no change. AMZN: 0.30 against 0.60.",
	],
	[
		"The agent has hard limits",
		"At most 3 USDG a trade and 10 USDG a market, and every transaction is simulated before it is sent.",
	],
	[
		"The money adds up",
		"Fuzz tests run 1,000 random trade sequences and settlements and check the market can always pay every winner.",
	],
] as const;

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
					<div className="max-w-2xl">
						<h2 className="text-3xl font-semibold tracking-tight">
							One weekend, step by step
						</h2>
						<p className="mt-3 text-muted-foreground">
							An example with TSLA closing Friday at $365. The market below is a
							simulation that uses the same rules as the live contracts, so you
							can trade it and follow the effect all the way to Monday.
						</p>
					</div>
					<div className="mt-10">
						<Walkthrough />
					</div>
				</section>

				<section
					id="system"
					className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16"
				>
					<div className="max-w-2xl">
						<h2 className="text-3xl font-semibold tracking-tight">
							What runs it
						</h2>
						<p className="mt-3 text-muted-foreground">
							Five contracts on Robinhood Chain and two small programs. A lender
							only ever talks to the oracle.
						</p>
					</div>
					<div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
						<div>
							<ArchitectureDiagram />
							<p className="mt-2 text-xs text-muted-foreground sm:hidden">
								Scroll the diagram sideways to see all of it.
							</p>
						</div>
						<dl className="divide-y border-y">
							{components.map(([name, meaning]) => (
								<div key={name} className="py-3">
									<dt className="font-medium">{name}</dt>
									<dd className="mt-0.5 text-sm text-muted-foreground">
										{meaning}
									</dd>
								</div>
							))}
						</dl>
					</div>
				</section>

				<section
					id="trust"
					className="mx-auto grid w-full max-w-6xl scroll-mt-20 gap-8 px-4 py-16 lg:grid-cols-[1fr_2fr]"
				>
					<div>
						<h2 className="text-3xl font-semibold tracking-tight">
							Why the price holds up
						</h2>
						<p className="mt-3 max-w-sm text-muted-foreground">
							A weekend price is only useful if it is expensive to fake and
							settles honestly.
						</p>
					</div>
					<dl className="divide-y border-y">
						{safeguards.map(([title, detail]) => (
							<div
								key={title}
								className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6"
							>
								<dt className="font-medium">{title}</dt>
								<dd className="text-muted-foreground">{detail}</dd>
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
