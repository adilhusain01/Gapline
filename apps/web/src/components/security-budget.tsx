import { ShieldCheck } from "lucide-react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MarketView } from "@/lib/gapline";
import { costToShiftMean } from "@/lib/lmsr";

const fmt = (x: number | undefined) =>
	x === undefined
		? "more than the market can absorb"
		: `${x.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDG`;

/** What it costs to push the oracle's implied price 1% either way: the market's security budget. */
export function SecurityBudget({ market }: { market: MarketView }) {
	if (market.resolved) return null;
	const down = costToShiftMean(market, -100);
	const up = costToShiftMean(market, 100);
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
					<span className="flex items-center gap-1.5 font-medium">
						<ShieldCheck className="size-3.5" />
						Cost to move the price 1%
					</span>
					<span className="font-mono tabular-nums text-muted-foreground">
						down {fmt(down)}
					</span>
					<span className="font-mono tabular-nums text-muted-foreground">
						up {fmt(up)}
					</span>
				</div>
			</TooltipTrigger>
			<TooltipContent className="max-w-72">
				USDG an attacker would pay the market maker, fees included, to shift the
				oracle's implied price by 1%. It grows with the market's depth; a lender
				should borrow only a fraction of it against this price.
			</TooltipContent>
		</Tooltip>
	);
}
