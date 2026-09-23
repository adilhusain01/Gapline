import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STOCK_SYMBOLS, type StockSymbol } from "@gapline/abi";
import { formatUnits, parseUnits } from "viem";

import { analystView } from "./analyst";
import { beliefFor, sharesToMove } from "./belief";
import { account, contracts, log, testnet } from "./chain";
import { stockConfig } from "./config";
import { currentClosure, currentMarket } from "./keeper";
import { recentMarkets } from "./markets";
import { dexSignal } from "./dex";
import { weekendCryptoMovePct } from "./signals";
import { ensureAllowance, send } from "./tx";

const scope = "trader";
const statePath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../logs/agent-state.json");

/** Net USDG the agent has put into each market (buys minus sells), persisted across restarts. */
function loadExposure(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}
function saveExposure(exposure: Record<string, number>) {
  writeFileSync(statePath, JSON.stringify(exposure, null, 2));
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export async function traderTick() {
  const closeTs = await currentClosure();
  if (closeTs === undefined) return;
  const markets = await recentMarkets();
  for (const symbol of STOCK_SYMBOLS) {
    try {
      await tradeStock(symbol, closeTs, markets);
    } catch (error) {
      log(scope, `${symbol} failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
}

/** One trade at most per stock per tick, toward the stock's belief, within the per-market caps. */
async function tradeStock(symbol: StockSymbol, closeTs: bigint, markets: Awaited<ReturnType<typeof recentMarkets>>) {
  const config = stockConfig(symbol);
  const market = currentMarket(markets, symbol, closeTs);
  if (!market) return;

  const [prices18, cryptoMove] = await Promise.all([
    testnet.readContract({ ...contracts.market, functionName: "prices", args: [market.id] }),
    weekendCryptoMovePct(closeTs),
  ]);
  const fridayClose = Number(formatUnits(market.refPrice, 8));
  const [view, dex] = await Promise.all([
    analystView(symbol, fridayClose),
    dexSignal(symbol, fridayClose, config.minDexTvlUsd, config.maxDexDeviationPct).catch(() => undefined),
  ]);
  const dexGap = dex?.usable ? dex.gapPct : undefined;
  const belief = beliefFor(config, market.boundariesBps, cryptoMove, dexGap, view?.drift_pct, view?.confidence);
  const prices = prices18.map((p) => Number(formatUnits(p, 18)));

  log(
    scope,
    `${symbol} #${market.id} BTC weekend ${cryptoMove.toFixed(2)}%, ` +
      `DEX ${dex ? `$${dex.price.toFixed(2)} (${dex.gapPct.toFixed(2)}%, $${Math.round(dex.tvlUsd / 1000)}K${dex.usable ? "" : ", ignored"})` : "unavailable"}` +
      `${view ? `, analyst ${view.drift_pct.toFixed(2)}%` : ""} -> ` +
      `belief mean ${belief.meanPct.toFixed(2)}% sd ${belief.sigmaPct}% | market [${prices.map(pct).join(" ")}] ` +
      `belief [${belief.probabilities.map(pct).join(" ")}]`,
  );

  // Act on the largest disagreement the agent can act on: a buy, or a sell of shares it holds (it never goes short).
  const holdings = await Promise.all(
    prices.map((_, i) =>
      testnet.readContract({
        ...contracts.market,
        functionName: "balanceOf",
        args: [account.address, (market.id << 8n) | BigInt(i)],
      }),
    ),
  );
  const actionable = belief.probabilities
    .map((t, i) => ({ i, t, p: prices[i], gap: t - prices[i] }))
    .filter((g) => g.gap > 0 || holdings[g.i] > 0n);
  if (actionable.length === 0) return;
  const target = actionable.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
  if (Math.abs(target.gap) < config.minEdge) return;

  const outcome = target.i;
  const liquidity = Number(formatUnits(market.liquidity, 18));
  const idealShares = Math.abs(sharesToMove(liquidity, target.p, target.t)) * config.aggressiveness;
  const exposure = loadExposure();
  const key = String(market.id);
  const spent = exposure[key] ?? 0;

  if (target.gap > 0) {
    const budget = Math.min(config.maxSpendPerTradeUsdg, config.maxExposureUsdg - spent);
    if (budget <= 0.01) {
      log(scope, `${symbol} exposure cap reached (${spent.toFixed(2)} USDG)`);
      return;
    }
    let shares = parseUnits(idealShares.toFixed(6), 18);
    let cost = await testnet.readContract({ ...contracts.market, functionName: "quoteBuy", args: [market.id, outcome, shares] });
    const budgetUnits = parseUnits(budget.toFixed(6), 6);
    if (cost > budgetUnits) {
      shares = (shares * budgetUnits) / cost; // LMSR cost is convex, so scaling down stays within budget
      cost = await testnet.readContract({ ...contracts.market, functionName: "quoteBuy", args: [market.id, outcome, shares] });
    }
    if (shares === 0n || !(await ensureAllowance(cost))) return;
    const hash = await send(scope, `${symbol} buy ${Number(formatUnits(shares, 18)).toFixed(2)} of range ${outcome} for ${formatUnits(cost, 6)} USDG`, {
      ...contracts.market,
      functionName: "buy",
      args: [market.id, outcome, shares, (cost * 102n) / 100n],
    });
    if (hash) saveExposure({ ...exposure, [key]: spent + Number(formatUnits(cost, 6)) });
  } else {
    const held = holdings[outcome];
    const want = parseUnits(idealShares.toFixed(6), 18);
    const shares = held < want ? held : want;
    if (shares === 0n) return;
    const proceeds = await testnet.readContract({ ...contracts.market, functionName: "quoteSell", args: [market.id, outcome, shares] });
    const hash = await send(scope, `${symbol} sell ${Number(formatUnits(shares, 18)).toFixed(2)} of range ${outcome} for ${formatUnits(proceeds, 6)} USDG`, {
      ...contracts.market,
      functionName: "sell",
      args: [market.id, outcome, shares, (proceeds * 98n) / 100n],
    });
    if (hash) saveExposure({ ...exposure, [key]: spent - Number(formatUnits(proceeds, 6)) });
  }
}
