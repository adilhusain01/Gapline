import { formatUnits } from "viem";

import { Progress } from "@/components/ui/progress";
import { rangeLabel, usd } from "@/lib/format";
import type { MarketView } from "@/lib/gapline";

/** The market's probability for each reopening range. */
export function MarketRanges({
  market,
  selected,
  onSelect,
  shares,
}: {
  market: MarketView;
  selected: number;
  onSelect: (index: number) => void;
  shares?: bigint[];
}) {
  return (
    <div className="space-y-1.5">
      {market.prices.map((price, index) => {
        const pct = Number(formatUnits(price, 18)) * 100;
        const isWinner = market.resolved && market.winner === index;
        const held = shares?.[index] ?? 0n;
        return (
          <button
            type="button"
            key={`${market.id}-${index}`}
            onClick={() => onSelect(index)}
            className={`w-full rounded-lg border p-3 text-left transition-colors ${
              selected === index ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"
            } ${isWinner ? "border-emerald-500/50 bg-emerald-500/10" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{rangeLabel(market.edges, index)}</span>
              <span className="font-mono text-sm tabular-nums">{pct.toFixed(1)}%</span>
            </div>
            <Progress value={pct} className="mt-2 h-1.5" />
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>
                {usd((market.refPrice * BigInt(10_000 + Number(market.edges[Math.min(index, market.edges.length - 1)]))) / 10_000n)}
                {index === 0 ? " or below" : index === market.edges.length ? " or above" : ""}
              </span>
              {held > 0n ? <span>{Number(formatUnits(held, 18)).toFixed(2)} shares</span> : null}
              {isWinner ? <span className="text-emerald-600 dark:text-emerald-400">settled here</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
