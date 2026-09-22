import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUnits, parseUnits } from "viem";

import { analystView } from "./analyst";
import { beliefFor, sharesToMove } from "./belief";
import { account, contracts, log, now, testnet } from "./chain";
import { config } from "./config";
import { currentMarket } from "./keeper";
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
  const ts = now();
  if (await testnet.readContract({ ...contracts.calendar, functionName: "isOpen", args: [ts] })) return;
  const closeTs = await testnet.readContract({ ...contracts.calendar, functionName: "lastClose", args: [ts] });
  const market = currentMarket(await recentMarkets(), closeTs);
  if (!market) return;

  const [prices18, cryptoMove] = await Promise.all([
    testnet.readContract({ ...contracts.market, functionName: "prices", args: [market.id] }),
    weekendCryptoMovePct(closeTs),
  ]);
  const fridayClose = Number(formatUnits(market.refPrice, 8));
  const [view, dex] = await Promise.all([
    analystView(fridayClose),
    dexSignal(fridayClose, config.minDexTvlUsd, config.maxDexDeviationPct).catch(() => undefined),
  ]);
  const dexGap = dex?.usable ? dex.gapPct : undefined;
  const belief = beliefFor(market.boundariesBps, cryptoMove, dexGap, view?.drift_pct, view?.confidence);
  const prices = prices18.map((p) => Number(formatUnits(p, 18)));

  log(
    scope,
    `#${market.id} BTC weekend ${cryptoMove.toFixed(2)}%, ` +
      `DEX ${dex ? `$${dex.price.toFixed(2)} (${dex.gapPct.toFixed(2)}%, $${Math.round(dex.tvlUsd / 1000)}K${dex.usable ? "" : ", ignored"})` : "unavailable"}` +
      `${view ? `, analyst ${view.drift_pct.toFixed(2)}%` : ""} -> ` +
      `belief mean ${belief.meanPct.toFixed(2)}% sd ${belief.sigmaPct}% | market [${prices.map(pct).join(" ")}] ` +
      `belief [${belief.probabilities.map(pct).join(" ")}]`,
  );

  // Act on the single largest disagreement, if it clears the threshold.
  const gaps = belief.probabilities.map((t, i) => ({ i, t, p: prices[i], gap: t - prices[i] }));
  const target = gaps.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
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
      log(scope, `exposure cap reached (${spent.toFixed(2)} USDG)`);
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
    const hash = await send(scope, `buy ${Number(formatUnits(shares, 18)).toFixed(2)} of range ${outcome} for ${formatUnits(cost, 6)} USDG`, {
      ...contracts.market,
      functionName: "buy",
      args: [market.id, outcome, shares, (cost * 102n) / 100n],
    });
    if (hash) saveExposure({ ...exposure, [key]: spent + Number(formatUnits(cost, 6)) });
  } else {
    const held = await testnet.readContract({
      ...contracts.market,
      functionName: "balanceOf",
      args: [account.address, (market.id << 8n) | BigInt(outcome)],
    });
    const want = parseUnits(idealShares.toFixed(6), 18);
    const shares = held < want ? held : want;
    if (shares === 0n) return; // the agent never goes short
    const proceeds = await testnet.readContract({ ...contracts.market, functionName: "quoteSell", args: [market.id, outcome, shares] });
    const hash = await send(scope, `sell ${Number(formatUnits(shares, 18)).toFixed(2)} of range ${outcome} for ${formatUnits(proceeds, 6)} USDG`, {
      ...contracts.market,
      functionName: "sell",
      args: [market.id, outcome, shares, (proceeds * 98n) / 100n],
    });
    if (hash) saveExposure({ ...exposure, [key]: spent - Number(formatUnits(proceeds, 6)) });
  }
}
