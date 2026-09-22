import { formatUnits } from "viem";

import { account, contracts, log, now, testnet } from "./chain";
import { config } from "./config";
import { recentMarkets, settlementRound, type Market } from "./markets";
import { ensureAllowance, send } from "./tx";

const scope = "keeper";

/** The unresolved market for the closure happening right now, if any. */
export function currentMarket(markets: Market[], closeTs: bigint) {
  return markets.find((m) => !m.resolved && m.closeTs === closeTs && m.reopenTs > now());
}

/** Opens this closure's market when the feed freezes and makes it the oracle's price source. */
async function openIfNeeded(markets: Market[]) {
  const ts = now();
  const isOpen = await testnet.readContract({ ...contracts.calendar, functionName: "isOpen", args: [ts] });
  if (isOpen) return;
  const closeTs = await testnet.readContract({ ...contracts.calendar, functionName: "lastClose", args: [ts] });
  if (currentMarket(markets, closeTs)) return;

  const liquidity = BigInt(Math.round(config.depth * 1e6)) * 10n ** 12n;
  const seed = BigInt(Math.ceil(config.depth * Math.log(config.edgesBps.length + 1) * 1e6));
  const balance = await testnet.readContract({ ...contracts.usdg, functionName: "balanceOf", args: [account.address] });
  if (balance < seed) {
    log(scope, `need ${formatUnits(seed, 6)} USDG to seed a market, have ${formatUnits(balance, 6)}`);
    return;
  }
  if (!(await ensureAllowance(seed))) return;
  await send(scope, `open market for closure at ${new Date(Number(closeTs) * 1000).toISOString()}`, {
    ...contracts.market,
    functionName: "createMarket",
    args: [contracts.feed.address, config.edgesBps, liquidity, config.tailWidthBps],
  });
}

/** Keeps the oracle pointed at the deepest market for the current closure. */
async function pointOracle(markets: Market[]) {
  const ts = now();
  const isOpen = await testnet.readContract({ ...contracts.calendar, functionName: "isOpen", args: [ts] });
  if (isOpen) return;
  const closeTs = await testnet.readContract({ ...contracts.calendar, functionName: "lastClose", args: [ts] });
  const live = markets.filter((m) => !m.resolved && m.closeTs === closeTs && m.reopenTs > ts);
  if (live.length === 0) return;
  const deepest = live.reduce((a, b) => (b.liquidity > a.liquidity ? b : a));
  const [active, hasActive] = await Promise.all([
    testnet.readContract({ ...contracts.oracle, functionName: "activeMarketId" }),
    testnet.readContract({ ...contracts.oracle, functionName: "hasActiveMarket" }),
  ]);
  if (hasActive && active === deepest.id) return;
  await send(scope, `point oracle at market #${deepest.id}`, {
    ...contracts.oracle,
    functionName: "setActiveMarket",
    args: [deepest.id],
  });
}

/** Has the lending pool buy this weekend's gap-down cover on the oracle's market, once per market. */
async function hedgePool(markets: Market[]) {
  const [active, hasActive, implied, totalDebt] = await Promise.all([
    testnet.readContract({ ...contracts.oracle, functionName: "activeMarketId" }),
    testnet.readContract({ ...contracts.oracle, functionName: "hasActiveMarket" }),
    testnet.readContract({ ...contracts.oracle, functionName: "isImplied" }),
    testnet.readContract({ ...contracts.pool, functionName: "totalDebt" }),
  ]);
  if (!hasActive || !implied || totalDebt === 0n) return;
  const market = markets.find((m) => m.id === active);
  if (!market || market.resolved) return;
  const already = await testnet.readContract({ ...contracts.pool, functionName: "hedgeShares", args: [active] });
  if (already > 0n) return;
  await send(scope, `pool buys gap cover on #${active} (loans ${formatUnits(totalDebt, 6)} USDG)`, {
    ...contracts.pool,
    functionName: "hedge",
    args: [active],
  });
}

/** Settles markets after the reopen, then collects winnings and the maker's residual. */
async function settleAndCollect(markets: Market[]) {
  for (const m of markets) {
    if (!m.resolved && m.reopenTs <= now()) {
      const round = await settlementRound(m.reopenTs);
      if (round === undefined) {
        log(scope, `market #${m.id} waiting for the first post-reopen feed round`);
        continue;
      }
      await send(scope, `settle market #${m.id} with round ${round}`, {
        ...contracts.market,
        functionName: "resolve",
        args: [m.id, round],
      });
    }
  }

  for (const m of await recentMarkets()) {
    if (!m.resolved) continue;
    const winningToken = (m.id << 8n) | BigInt(m.winner);
    const held = await testnet.readContract({
      ...contracts.market,
      functionName: "balanceOf",
      args: [account.address, winningToken],
    });
    const poolHeld = await testnet.readContract({
      ...contracts.market,
      functionName: "balanceOf",
      args: [contracts.pool.address, winningToken],
    });
    if (poolHeld > 0n) {
      await send(scope, `pool collects ${formatUnits(poolHeld, 18)} USDG of cover from #${m.id}`, {
        ...contracts.pool,
        functionName: "collectHedge",
        args: [m.id],
      });
    }
    if (held > 0n) {
      await send(scope, `redeem ${formatUnits(held, 18)} winning shares of #${m.id}`, {
        ...contracts.market,
        functionName: "redeem",
        args: [m.id],
      });
    }
    if (m.creator.toLowerCase() === account.address.toLowerCase()) {
      const owed = await testnet.readContract({ ...contracts.market, functionName: "totalSupply", args: [winningToken] });
      const fresh = (await recentMarkets()).find((x) => x.id === m.id);
      // Same rounding as the contract: winners are owed ceil(shares / 1e12) USDG units.
      const owedUsdg = (owed + 10n ** 12n - 1n) / 10n ** 12n;
      if (fresh && fresh.collateralHeld > owedUsdg) {
        await send(scope, `withdraw maker residual from #${m.id}`, {
          ...contracts.market,
          functionName: "withdrawResidual",
          args: [m.id],
        });
      }
      if (fresh && fresh.feesAccrued > 0n) {
        await send(scope, `claim ${formatUnits(fresh.feesAccrued, 6)} USDG of underwriter fees from #${m.id}`, {
          ...contracts.market,
          functionName: "claimFees",
          args: [m.id],
        });
      }
    }
  }
}

export async function keeperTick() {
  const markets = await recentMarkets();
  await openIfNeeded(markets);
  const refreshed = await recentMarkets();
  await pointOracle(refreshed);
  await hedgePool(refreshed);
  await settleAndCollect(refreshed);
}
