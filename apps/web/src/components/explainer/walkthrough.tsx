import { RotateCcw } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	BAND_SIGMAS,
	buyCost,
	COVER_SHARE,
	EDGES_BPS,
	FRIDAY_CLOSE,
	LIQUIDATION_THRESHOLD,
	MAX_LTV,
	priceBand,
	prices,
	rangeName,
	SATURDAY,
	winningRange,
} from "./weekend-math";

const money = (n: number) =>
	n.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
const pct = (bps: number, digits = 2) =>
	`${bps > 0 ? "+" : ""}${(bps / 100).toFixed(digits)}%`;

const SHARES_PER_CLICK = 5;
const COLLATERAL = 10;

type Step = { when: string; title: string; body: ReactNode; visual: ReactNode };

/** A panel the visuals sit on: a hairline frame, no shadow. */
function Panel({ children, label }: { children: ReactNode; label?: string }) {
	return (
		<div className="rounded-lg border bg-card p-4 sm:p-5">
			{label ? (
				<p className="mb-3 text-xs text-muted-foreground">{label}</p>
			) : null}
			{children}
		</div>
	);
}

function FrozenFeed() {
	return (
		<Panel label="Saturday, 11:40 ET (example)">
			<dl className="divide-y">
				<div className="flex items-baseline justify-between gap-4 pb-3">
					<div>
						<dt className="font-medium">Chainlink TSLA / USD</dt>
						<dd className="text-xs text-muted-foreground">
							last update Friday 16:00 ET, frozen until Sunday 20:00 ET
						</dd>
					</div>
					<dd className="font-mono text-xl text-frozen tabular-nums">
						{money(FRIDAY_CLOSE)}
					</dd>
				</div>
				<div className="flex items-baseline justify-between gap-4 pt-3">
					<div>
						<dt className="font-medium">TSLA token on Uniswap</dt>
						<dd className="text-xs text-emerald-600 dark:text-emerald-400">
							still trading
						</dd>
					</div>
					<dd className="font-mono text-xl tabular-nums">$361.90</dd>
				</div>
			</dl>
		</Panel>
	);
}

/** Probability per range, one hue, with a buy control on every row. */
function RangeOdds({
	q,
	mine,
	onBuy,
	highlight,
}: {
	q: number[];
	mine: number[];
	onBuy?: (i: number) => void;
	highlight?: number;
}) {
	const p = prices(q);
	const max = Math.max(...p);
	return (
		<ul
			className="space-y-1.5"
			aria-label="Probability of each reopening range"
		>
			{p.map((pi, i) => {
				const lo =
					i === 0 ? undefined : FRIDAY_CLOSE * (1 + EDGES_BPS[i - 1] / 10_000);
				const won = highlight === i;
				return (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: ranges are a fixed, ordered set
						key={i}
						className={`grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 rounded-md px-2 py-1 sm:grid-cols-[8rem_1fr_3rem_auto] ${won ? "bg-band/15" : ""}`}
						title={`${rangeName(i)}: ${(pi * 100).toFixed(1)}%${lo ? `, reopen above ${money(lo)}` : ""}`}
					>
						<span className="text-sm">
							{rangeName(i)}
							{mine[i] > 0 ? (
								<span className="block text-xs text-band">
									you hold {mine[i]}
								</span>
							) : null}
						</span>
						<span className="h-2 overflow-hidden rounded-full bg-muted">
							<span
								className="block h-full rounded-full bg-band transition-[width] duration-300"
								style={{ width: `${(pi / max) * 100}%` }}
							/>
						</span>
						<span className="text-right font-mono text-sm tabular-nums">
							{(pi * 100).toFixed(1)}%
						</span>
						{onBuy ? (
							<Button
								variant="outline"
								size="xs"
								className="col-span-3 justify-self-end sm:col-span-1"
								onClick={() => onBuy(i)}
								aria-label={`Buy ${SHARES_PER_CLICK} shares of ${rangeName(i)} for ${money(buyCost(q, i, SHARES_PER_CLICK))}`}
							>
								Buy {SHARES_PER_CLICK} for{" "}
								{money(buyCost(q, i, SHARES_PER_CLICK)).replace("$", "")} USDG
							</Button>
						) : null}
					</li>
				);
			})}
		</ul>
	);
}

/** Friday's close, the implied price and its band on one price axis. */
function BandAxis({ q }: { q: number[] }) {
	const band = priceBand(q);
	const lo = FRIDAY_CLOSE * 0.9;
	const hi = FRIDAY_CLOSE * 1.1;
	const at = (price: number) =>
		`${Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100))}%`;
	return (
		<div>
			<div
				className="relative h-16"
				role="img"
				aria-label={`Implied price ${money(band.mid)}, range ${money(band.low)} to ${money(band.high)}, Friday close ${money(FRIDAY_CLOSE)}`}
			>
				<div className="absolute inset-x-0 top-8 h-px bg-border" />
				<div
					className="absolute top-5 h-6 rounded-sm bg-band/20 ring-1 ring-band/60 ring-inset transition-all duration-300"
					style={{
						left: at(band.low),
						width: `calc(${at(band.high)} - ${at(band.low)})`,
					}}
				/>
				<div
					className="absolute top-3 h-10 w-0.5 bg-band transition-all duration-300"
					style={{ left: at(band.mid) }}
				/>
				<div
					className="absolute top-2 h-12 border-l-2 border-dashed border-frozen"
					style={{ left: at(FRIDAY_CLOSE) }}
				/>
			</div>
			<div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground tabular-nums">
				<span>{money(lo)}</span>
				<span>{money(hi)}</span>
			</div>
			<dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
				<div>
					<dt className="text-xs text-muted-foreground">Low end</dt>
					<dd className="font-mono tabular-nums">{money(band.low)}</dd>
				</div>
				<div>
					<dt className="text-xs text-band">Implied price</dt>
					<dd className="font-mono text-lg tabular-nums">{money(band.mid)}</dd>
				</div>
				<div>
					<dt className="text-xs text-muted-foreground">High end</dt>
					<dd className="font-mono tabular-nums">{money(band.high)}</dd>
				</div>
			</dl>
			<p className="mt-3 text-xs text-muted-foreground">
				Expected move {pct(band.mean)}, range {BAND_SIGMAS} standard deviations
				(±{pct(band.sd * BAND_SIGMAS).replace("+", "")}) either side. The dashed
				line is Friday's close.
			</p>
		</div>
	);
}

function LenderView({ q }: { q: number[] }) {
	const band = priceBand(q);
	const rows = [
		{
			label: "A lender reading the frozen feed",
			value: COLLATERAL * FRIDAY_CLOSE,
			lend: COLLATERAL * FRIDAY_CLOSE * MAX_LTV,
			muted: true,
		},
		{
			label: "Gapline's pool, at the low end",
			value: COLLATERAL * band.low,
			lend: COLLATERAL * band.low * MAX_LTV,
			muted: false,
		},
	];
	return (
		<Panel label={`${COLLATERAL} TSLA deposited as collateral`}>
			<table className="w-full text-sm">
				<thead className="text-left text-xs text-muted-foreground">
					<tr>
						<th className="pb-2 font-normal" />
						<th className="pb-2 text-right font-normal">Collateral worth</th>
						<th className="pb-2 text-right font-normal">Lends up to</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{rows.map((r) => (
						<tr
							key={r.label}
							className={r.muted ? "text-muted-foreground" : ""}
						>
							<td className="py-2 pr-2">{r.label}</td>
							<td className="py-2 text-right font-mono tabular-nums">
								{money(r.value)}
							</td>
							<td className="py-2 text-right font-mono tabular-nums">
								{money(r.lend)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className="mt-4 border-t pt-3 text-sm">
				Liquidation only if the debt passes{" "}
				<span className="font-mono tabular-nums">
					{money(COLLATERAL * band.high * LIQUIDATION_THRESHOLD)}
				</span>{" "}
				<span className="text-muted-foreground">
					({LIQUIDATION_THRESHOLD * 100}% of the collateral at the high end,{" "}
					{money(band.high)})
				</span>
			</p>
		</Panel>
	);
}

function Settlement({
	q,
	mine,
	spent,
	move,
	onMove,
}: {
	q: number[];
	mine: number[];
	spent: number;
	move: number;
	onMove: (bps: number) => void;
}) {
	const winner = winningRange(move);
	const price = FRIDAY_CLOSE * (1 + move / 10_000);
	const held = mine.reduce((a, b) => a + b, 0);
	return (
		<Panel>
			<label
				htmlFor="reopen"
				className="flex items-baseline justify-between gap-4 text-sm"
			>
				<span>TSLA reopens at</span>
				<span className="font-mono text-lg tabular-nums">
					{money(price)}{" "}
					<span className="text-sm text-muted-foreground">({pct(move)})</span>
				</span>
			</label>
			<input
				id="reopen"
				type="range"
				min={-600}
				max={600}
				step={10}
				value={move}
				onChange={(event) => onMove(Number(event.target.value))}
				className="mt-3 w-full accent-[var(--band)]"
			/>
			<div className="mt-4">
				<RangeOdds q={q} mine={mine} highlight={winner} />
			</div>
			<div className="mt-4 space-y-1 border-t pt-3 text-sm">
				<p>
					Winning range:{" "}
					<span className="font-medium">{rangeName(winner)}</span>.{" "}
					{held === 0
						? "Buy a range in step 2 to see your payout here."
						: mine[winner] > 0
							? `Your ${mine[winner]} winning shares pay ${mine[winner]}.00 USDG; you spent ${spent.toFixed(2)} USDG in total.`
							: `None of your ${held} shares won; you spent ${spent.toFixed(2)} USDG.`}
				</p>
				<p className="text-muted-foreground">
					{winner === 0
						? `The pool's cover pays out: ${COVER_SHARE * 100}% of its loans, into its reserves.`
						: "The pool's cover expires unused; its premium was the cost of insurance."}
				</p>
			</div>
		</Panel>
	);
}

/** One weekend, step by step, on a simulated market with the live parameters. */
export function Walkthrough() {
	const [q, setQ] = useState(SATURDAY);
	const [mine, setMine] = useState<number[]>(() => SATURDAY.map(() => 0));
	const [spent, setSpent] = useState(0);
	const [move, setMove] = useState(-110);

	function buy(i: number) {
		setSpent((s) => s + buyCost(q, i, SHARES_PER_CLICK));
		setQ((prev) => prev.map((qi, j) => (j === i ? qi + SHARES_PER_CLICK : qi)));
		setMine((prev) => prev.map((m, j) => (j === i ? m + SHARES_PER_CLICK : m)));
	}

	function reset() {
		setQ(SATURDAY);
		setMine(SATURDAY.map(() => 0));
		setSpent(0);
	}

	const steps: Step[] = [
		{
			when: "Friday, 20:00 ET",
			title: "The price feed stops",
			body: (
				<>
					NYSE closes, and Chainlink's TSLA and AMZN feeds stop updating until
					Sunday 20:00 ET: 52 to 78 hours on the weekends we measured. The
					tokens keep trading on-chain, so a lender reading the feed values
					collateral at Friday's price all weekend. Gapline opens a market on
					where the stock reopens, split into seven ranges around Friday's
					close.
				</>
			),
			visual: <FrozenFeed />,
		},
		{
			when: "Saturday and Sunday",
			title: "People trade the ranges",
			body: (
				<>
					A share in a range pays 1 USDG if the stock reopens inside it. An
					automated market maker (LMSR) always quotes every range, so there is
					no waiting for someone on the other side, and each range's price reads
					as its probability. A pricing agent trades too, from the token's
					Uniswap price and Bitcoin's weekend move, within hard spending limits.
					<span className="mt-3 block text-foreground">
						Try it: buy a range and watch the odds, the price and the lender's
						numbers below move.
					</span>
				</>
			),
			visual: (
				<Panel label="Where does TSLA reopen? (simulated market, live parameters)">
					<RangeOdds q={q} mine={mine} onBuy={buy} />
					<div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
						<span>
							{spent > 0
								? `You spent ${spent.toFixed(2)} USDG`
								: "Prices include the 1% trading fee"}
						</span>
						<Button variant="ghost" size="xs" onClick={reset}>
							<RotateCcw className="size-3" />
							Reset
						</Button>
					</div>
				</Panel>
			),
		},
		{
			when: "Every block",
			title: "The oracle turns odds into a price",
			body: (
				<>
					The oracle weights each range by its probability to get the expected
					move from Friday's close, and uses how spread out the odds are for a
					range of two standard deviations either side. Lenders read it with{" "}
					<code className="font-mono text-sm">latestRoundData()</code>, the same
					call they already make to Chainlink. While the stock market is open it
					passes Chainlink's live price straight through.
				</>
			),
			visual: (
				<Panel label="What the oracle publishes">
					<BandAxis q={q} />
				</Panel>
			),
		},
		{
			when: "All weekend",
			title: "Lenders use the range, not one number",
			body: (
				<>
					The demo lending pool values new loans at the low end, so an
					optimistic weekend can't inflate borrowing. It liquidates only if a
					loan is underwater even at the high end, so one thin weekend trade
					can't wipe anyone out. Each weekend it also buys cover that pays{" "}
					{COVER_SHARE * 100}% of its loans if the stock reopens 3% or more
					lower.
				</>
			),
			visual: <LenderView q={q} />,
		},
		{
			when: "Sunday, 20:00 ET",
			title: "The first real price settles it",
			body: (
				<>
					When the market reopens, the first Chainlink price published at or
					after 20:00 ET picks the winning range; a later, friendlier price
					can't be chosen instead. Winning shares pay 1 USDG each, losing shares
					pay nothing, and the oracle goes back to the live feed.
				</>
			),
			visual: (
				<Settlement
					q={q}
					mine={mine}
					spent={spent}
					move={move}
					onMove={setMove}
				/>
			),
		},
	];

	return (
		<ol className="divide-y border-y">
			{steps.map((step, index) => (
				<li
					key={step.title}
					className="grid gap-6 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
				>
					<div className="flex gap-4">
						<span className="grid size-8 shrink-0 place-items-center rounded-full border border-band/50 font-mono text-sm text-band">
							{index + 1}
						</span>
						<div>
							<p className="text-sm text-band">{step.when}</p>
							<h3 className="mt-1 text-xl font-semibold tracking-tight">
								{step.title}
							</h3>
							<p className="mt-3 max-w-prose text-muted-foreground">
								{step.body}
							</p>
						</div>
					</div>
					<div>{step.visual}</div>
				</li>
			))}
		</ol>
	);
}
