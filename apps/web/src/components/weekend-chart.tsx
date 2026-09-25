/**
 * One weekend, drawn to scale by day: Friday trading, Chainlink's feed frozen at the close, Gapline's price and
 * range widening across the closure, and the reopen landing inside the range. An illustration, not live data.
 * Shapes are SVG; labels are HTML placed by percentage so they stay readable at any width.
 */

// Drawn on a 960-wide grid; the view crops to y 110-300, where the data is. Columns: Friday 40-260,
// Saturday 260-510, Sunday 510-760, Monday session 760-920.
const TOP = 110;
const HEIGHT = 190;
const x = (value: number) => `${(value / 960) * 100}%`;
const y = (value: number) => `${((value - TOP) / HEIGHT) * 100}%`;

const days = [
	{ label: "Friday", at: 40 },
	{ label: "Saturday", at: 260 },
	{ label: "Sunday", at: 510 },
	{ label: "Monday session", at: 760 },
];

export function WeekendChart() {
	return (
		<figure className="space-y-3">
			<div className="relative aspect-[960/190] w-full">
				<svg
					viewBox={`0 ${TOP} 960 ${HEIGHT}`}
					className="absolute inset-0 size-full overflow-visible"
					role="img"
					aria-label="Friday's price stops at the close. Chainlink's feed stays flat all weekend while Gapline's range widens around a falling estimate, and Monday's reopen lands inside the range."
				>
					{[260, 510, 760].map((at) => (
						<line
							key={at}
							x1={at}
							x2={at}
							y1={TOP + 22}
							y2={TOP + HEIGHT}
							className="stroke-border"
							strokeWidth={1}
						/>
					))}

					<g className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-1000">
						<path
							d="M260,168 C420,160 600,150 760,150 L760,250 C600,245 420,200 260,168 Z"
							className="fill-band/20 stroke-band/50"
							strokeWidth={1}
						/>
						<path
							d="M260,168 C420,178 600,195 760,200"
							className="fill-none stroke-band"
							strokeWidth={2.5}
							strokeLinecap="round"
						/>
					</g>

					<path
						d="M260,168 H760"
						className="fill-none stroke-frozen"
						strokeWidth={2}
						strokeDasharray="6 6"
					/>

					<path
						d="M40,190 L70,178 L95,186 L120,168 L150,174 L175,160 L200,171 L225,163 L245,172 L260,168"
						className="fill-none stroke-foreground"
						strokeWidth={2}
						strokeLinejoin="round"
					/>
					<path
						d="M760,206 L785,200 L810,210 L835,198 L860,204 L885,195 L920,199"
						className="fill-none stroke-foreground"
						strokeWidth={2}
						strokeLinejoin="round"
					/>

					<circle cx={260} cy={168} r={4} className="fill-foreground" />
					<circle
						cx={760}
						cy={206}
						r={6}
						className="fill-background stroke-band"
						strokeWidth={2.5}
					/>
				</svg>

				{days.map((day) => (
					<span
						key={day.label}
						className="absolute top-0 pl-2 text-xs text-muted-foreground"
						style={{ left: x(day.at) }}
					>
						{day.label}
					</span>
				))}

				<span
					className="absolute hidden -translate-y-full pl-2 text-xs text-muted-foreground sm:block"
					style={{ left: x(268), top: y(160) }}
				>
					Chainlink feed, frozen at Friday's close
				</span>
				<span
					className="absolute hidden text-xs font-medium text-band sm:block"
					style={{ left: x(470), top: y(236) }}
				>
					Gapline price and range
				</span>
				<span
					className="absolute hidden pl-3 text-xs text-muted-foreground sm:block"
					style={{ left: x(760), top: y(222) }}
				>
					Reopens inside the range
				</span>
				<span
					className="absolute hidden -translate-x-full pr-2 text-xs text-muted-foreground sm:block"
					style={{ left: x(260), top: y(272) }}
				>
					Fri 20:00 ET
				</span>
				<span
					className="absolute hidden -translate-x-full pr-2 text-xs text-muted-foreground sm:block"
					style={{ left: x(760), top: y(272) }}
				>
					Sun 20:00 ET
				</span>
			</div>

			<figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground sm:hidden">
				<span className="flex items-center gap-2">
					<span className="h-0 w-4 border-t-2 border-dashed border-frozen" />
					Chainlink feed, frozen
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2 w-4 rounded-sm bg-band/40" />
					Gapline price and range
				</span>
			</figcaption>
		</figure>
	);
}
