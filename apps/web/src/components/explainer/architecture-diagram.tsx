/**
 * How the pieces connect, top to bottom in the order data flows. Drawn to the diagram-design rules: right-angle
 * connectors with rounded bends, labels clear of their lines on a background mask, one focal node (the oracle,
 * which is what lenders read), a legend strip at the bottom. Colors come from the theme, so it follows light/dark.
 */

type Point = [number, number];
const R = 8;

/** An orthogonal path through `points` with rounded (r=8) bends. */
function elbow(points: Point[]) {
	let d = `M${points[0][0]},${points[0][1]}`;
	for (let i = 1; i < points.length - 1; i++) {
		const [px, py] = points[i - 1];
		const [x, y] = points[i];
		const [nx, ny] = points[i + 1];
		const inX = Math.sign(x - px);
		const inY = Math.sign(y - py);
		const outX = Math.sign(nx - x);
		const outY = Math.sign(ny - y);
		d += ` L${x - inX * R},${y - inY * R} Q${x},${y} ${x + outX * R},${y + outY * R}`;
	}
	const [lx, ly] = points[points.length - 1];
	return `${d} L${lx},${ly}`;
}

type NodeKind = "step" | "focal" | "external" | "offchain";

function Node({
	x,
	y,
	w = 200,
	h,
	name,
	sub,
	kind = "step",
}: {
	x: number;
	y: number;
	w?: number;
	h: number;
	name: string;
	sub: string;
	kind?: NodeKind;
}) {
	const box =
		kind === "focal"
			? "fill-band/10 stroke-band"
			: kind === "external"
				? "fill-muted stroke-border"
				: "fill-card stroke-foreground/40";
	return (
		<g>
			<rect
				x={x}
				y={y}
				width={w}
				height={h}
				rx={6}
				className="fill-background"
			/>
			<rect
				x={x}
				y={y}
				width={w}
				height={h}
				rx={6}
				className={box}
				strokeWidth={kind === "focal" ? 1.5 : 1}
				strokeDasharray={kind === "offchain" ? "4 3" : undefined}
			/>
			<text
				x={x + w / 2}
				y={y + h / 2 - 3}
				textAnchor="middle"
				className="fill-foreground text-[13px] font-semibold"
			>
				{name}
			</text>
			<text
				x={x + w / 2}
				y={y + h / 2 + 14}
				textAnchor="middle"
				className="fill-muted-foreground text-[11px]"
			>
				{sub}
			</text>
		</g>
	);
}

function Label({
	x,
	y,
	text,
	anchor = "middle",
}: {
	x: number;
	y: number;
	text: string;
	anchor?: "start" | "middle" | "end";
}) {
	// ~6px per character at 11px; the mask sits behind the text only.
	const w = text.length * 6 + 8;
	const left =
		anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w + 4 : x - 4;
	return (
		<g>
			<rect
				x={left}
				y={y - 10}
				width={w}
				height={14}
				rx={2}
				className="fill-background"
			/>
			<text
				x={x}
				y={y}
				textAnchor={anchor}
				className="fill-muted-foreground text-[11px]"
			>
				{text}
			</text>
		</g>
	);
}

export function ArchitectureDiagram() {
	const arrow = "fill-none stroke-muted-foreground";
	return (
		<div className="overflow-x-auto">
			<svg
				viewBox="0 0 720 580"
				className="mx-auto w-full min-w-[600px] max-w-3xl font-sans"
				role="img"
				aria-labelledby="gapline-arch-title gapline-arch-desc"
			>
				<title id="gapline-arch-title">How Gapline's pieces connect</title>
				<desc id="gapline-arch-desc">
					The market calendar tells GapMarket when the stock market is closed;
					traders and the agent trade its ranges, priced by the LmsrMath Stylus
					program; the oracle turns the odds into a price and band, and the
					lending pool reads it and buys cover in GapMarket. Chainlink's feed
					sets Friday's close, settles the market and supplies the live price
					while the market is open.
				</desc>
				<defs>
					<marker
						id="arch-arrow"
						markerWidth="8"
						markerHeight="6"
						refX="7"
						refY="3"
						orient="auto"
					>
						<polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground" />
					</marker>
					<marker
						id="arch-arrow-start"
						markerWidth="8"
						markerHeight="6"
						refX="1"
						refY="3"
						orient="auto"
					>
						<polygon points="8 0, 0 3, 8 6" className="fill-muted-foreground" />
					</marker>
				</defs>

				{/* Connectors first, so boxes sit on top of them. */}
				<path
					d={elbow([
						[330, 84],
						[330, 150],
					])}
					className={arrow}
					markerEnd="url(#arch-arrow)"
				/>
				<path
					d={elbow([
						[600, 84],
						[600, 112],
						[400, 112],
						[400, 150],
					])}
					className={arrow}
					markerEnd="url(#arch-arrow)"
				/>
				<path
					d={elbow([
						[160, 84],
						[160, 186],
						[260, 186],
					])}
					className={arrow}
					markerEnd="url(#arch-arrow)"
				/>
				<path
					d={elbow([
						[80, 84],
						[80, 326],
						[260, 326],
					])}
					className={arrow}
					markerEnd="url(#arch-arrow)"
				/>
				<path
					d={elbow([
						[460, 186],
						[500, 186],
					])}
					className={arrow}
					markerStart="url(#arch-arrow-start)"
					markerEnd="url(#arch-arrow)"
				/>
				<path
					d={elbow([
						[360, 222],
						[360, 290],
					])}
					className={arrow}
					markerEnd="url(#arch-arrow)"
				/>
				<path
					d={elbow([
						[360, 362],
						[360, 430],
					])}
					className="fill-none stroke-band"
					strokeWidth={1.5}
					markerEnd="url(#arch-arrow)"
				/>
				<path
					d={elbow([
						[460, 466],
						[600, 466],
						[600, 256],
						[410, 256],
						[410, 222],
					])}
					className={arrow}
					strokeDasharray="5 4"
					markerEnd="url(#arch-arrow)"
				/>

				<Label x={322} y={124} text="trades" anchor="end" />
				<Label x={500} y={104} text="open or closed" />
				<Label x={210} y={178} text="settles" />
				<Label x={170} y={318} text="live price" />
				<Label x={352} y={262} text="odds" anchor="end" />
				<Label x={352} y={402} text="price and band" anchor="end" />
				<Label x={608} y={366} text="buys cover" anchor="start" />

				<Node
					x={20}
					y={20}
					h={64}
					name="Chainlink stock feed"
					sub="copied to testnet by our relayer"
					kind="external"
				/>
				<Node
					x={260}
					y={20}
					h={64}
					name="Traders and the agent"
					sub="the agent also opens and settles"
					kind="offchain"
				/>
				<Node
					x={500}
					y={20}
					h={64}
					name="MarketCalendar"
					sub="NYSE hours, holidays, DST"
				/>
				<Node
					x={260}
					y={150}
					h={72}
					name="GapMarket"
					sub="seven ranges, paid in USDG"
				/>
				<Node
					x={500}
					y={150}
					h={72}
					name="LmsrMath"
					sub="Rust on Arbitrum Stylus"
				/>
				<Node
					x={260}
					y={290}
					h={72}
					name="ImpliedPriceOracle"
					sub="Chainlink-compatible price"
					kind="focal"
				/>
				<Node
					x={260}
					y={430}
					h={72}
					name="Lending pool"
					sub="borrows low, liquidates high"
				/>

				{/* Legend strip */}
				<line x1={20} y1={532} x2={700} y2={532} className="stroke-border" />
				<rect
					x={20}
					y={548}
					width={14}
					height={10}
					rx={2}
					className="fill-band/10 stroke-band"
				/>
				<text x={40} y={557} className="fill-muted-foreground text-[11px]">
					what lenders read
				</text>
				<rect
					x={170}
					y={548}
					width={14}
					height={10}
					rx={2}
					className="fill-muted stroke-border"
				/>
				<text x={190} y={557} className="fill-muted-foreground text-[11px]">
					outside data
				</text>
				<rect
					x={300}
					y={548}
					width={14}
					height={10}
					rx={2}
					className="fill-card stroke-foreground/40"
					strokeDasharray="3 2"
				/>
				<text x={320} y={557} className="fill-muted-foreground text-[11px]">
					off-chain
				</text>
				<rect
					x={410}
					y={548}
					width={14}
					height={10}
					rx={2}
					className="fill-card stroke-foreground/40"
				/>
				<text x={430} y={557} className="fill-muted-foreground text-[11px]">
					contract
				</text>
			</svg>
		</div>
	);
}
