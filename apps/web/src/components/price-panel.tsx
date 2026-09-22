import { Activity, Clock, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { bpsToPercent, countdown, percent, timeAgo, usd } from "@/lib/format";
import { useSessionStatus, type MarketView } from "@/lib/gapline";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PricePanel({ active }: { active?: MarketView }) {
  const status = useSessionStatus();
  const now = Math.floor(Date.now() / 1000);

  if (status.isLoading || status.isOpen === undefined) {
    return <Skeleton className="h-44 w-full" />;
  }

  const implied = status.band?.implied ?? false;
  const move = active ? bpsToPercent(active.meanBps) : 0;
  const Trend = move >= 0 ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium">TSLA on Robinhood Chain</CardTitle>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="size-3.5" />
          {implied ? "priced by the weekend market" : "live Chainlink feed"}
        </span>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {implied ? "Implied price now" : "Feed price"}
          </p>
          <p className="font-mono text-3xl tabular-nums">{usd(status.band?.mid)}</p>
          {implied && active ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Trend className="size-3.5" />
              {percent(move, 2)} vs Friday close {usd(active.refPrice)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              feed updated {status.feedUpdatedAt ? timeAgo(status.feedUpdatedAt) : "--"}
            </p>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Stat
                label="Confidence band"
                value={implied ? `${usd(status.band?.low)} - ${usd(status.band?.high)}` : "live price"}
                hint={implied ? "borrowing uses the low end, liquidation the high end" : "no band while the feed is live"}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            Two standard deviations of the market's implied move. Lenders read this instead of a frozen feed.
          </TooltipContent>
        </Tooltip>

        <Stat
          label={status.isOpen ? "Session closes in" : "Session reopens in"}
          value={
            status.isOpen
              ? status.lastClose
                ? countdown(Number(status.nextOpen ?? 0n) - now)
                : "--"
              : countdown(Number(status.nextOpen ?? 0n) - now)
          }
          hint={
            status.isOpen
              ? "24/5 session, closes Friday 20:00 ET"
              : `frozen since ${status.lastClose ? new Date(Number(status.lastClose) * 1000).toUTCString().slice(0, 22) : "--"}`
          }
        />
      </CardContent>
      {!status.isOpen && !implied ? (
        <CardContent className="pt-0">
          <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <Clock className="size-4 shrink-0" />
            The feed is frozen and no weekend market is pricing it. Lending is paused until one opens.
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
