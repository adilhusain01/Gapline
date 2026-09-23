import { STOCK_SYMBOLS, type StockSymbol } from "@gapline/abi";
import { formatUnits } from "viem";

import { account, contracts, log, now, stockContracts, testnet } from "./chain";
import { config } from "./config";
import { recentMarkets, settlementRound, type Market } from "./markets";
import { ensureAllowance, send } from "./tx";

const scope = "keeper";

/** `symbol`'s unresolved market for the closure happening right now, if any. */
export function currentMarket(markets: Market[], symbol: StockSymbol, closeTs: bigint) {
  return markets.find((m) => m.symbol === symbol && !m.resolved && m.closeTs === closeTs && m.reopenTs > now());
}

/** The closure in progress (its Friday close timestamp), or undefined while the market is open. */
export async function currentClosure() {
  const ts = now();
  const isOpen = await testnet.readContract({ ...contracts.calendar, functionName: "isOpen", args: [ts] });
  if (isOpen) return undefined;
  return testnet.readContract({ ...contracts.calendar, functionName: "lastClose", args: [ts] });
}

/** Opens `symbol`'s market for this closure when its feed freezes. */
async function openIfNeeded(markets: Market[], symbol: StockSymbol, closeTs: bigint) {
  if (currentMarket(markets, symbol, closeTs)) return;

  const liquidity = BigInt(Math.round(config.depth * 1e6)) * 10n ** 12n;
  const seed = BigInt(Math.ceil(config.depth * Math.log(config.edgesBps.length + 1) * 1e6));
  const balance = await testnet.readContract({ ...contracts.usdg, functionName: "balanceOf", args: [account.address] });
  if (balance < seed) {
    log(scope, `need ${formatUnits(seed, 6)} USDG to seed the ${symbol} market, have ${formatUnits(balance, 6)}`);
    return;
  }
  if (!(await ensureAllowance(seed))) return;
  await send(scope, `open ${symbol} market for closure at ${new Date(Number(closeTs) * 1000).toISOString()}`, {
    ...contracts.market,
    functionName: "createMarket",
    args: [stockContracts(symbol).feed.address, config.edgesBps, liquidity, config.tailWidthBps],
  });
}

/** Keeps `symbol`'s oracle pointed at the deepest market for the current closure. */
async function pointOracle(markets: Market[], symbol: StockSymbol, closeTs: bigint) {
  const { oracle } = stockContracts(symbol);
  const live = markets.filter((m) => m.symbol === symbol && !m.resolved && m.closeTs === closeTs && m.reopenTs > now());
  if (live.length === 0) return;
  const deepest = live.reduce((a, b) => (b.liquidity > a.liquidity ? b : a));
  const [active, hasActive] = await Promise.all([
    testnet.readContract({ ...oracle, functionName: "activeMarketId" }),
    testnet.readContract({ ...oracle, functionName: "hasActiveMarket" }),
  ]);
  if (hasActive && active === deepest.id) return;
  await send(scope, `point ${symbol} oracle at market #${deepest.id}`, {
    ...oracle,
    functionName: "setActiveMarket",
    args: [deepest.id],
  });
}

/** Has `symbol`'s lending pool buy this weekend's gap-down cover on its oracle's market, once per market. */
async function hedgePool(markets: Market[], symbol: StockSymbol) {
  const { oracle, pool } = stockContracts(symbol);
  const [active, hasActive, implied, totalDebt] = await Promise.all([
    testnet.readContract({ ...oracle, functionName: "activeMarketId" }),
    testnet.readContract({ ...oracle, functionName: "hasActiveMarket" }),
    testnet.readContract({ ...oracle, functionName: "isImplied" }),
    testnet.readContract({ ...pool, functionName: "totalDebt" }),
  ]);
  if (!hasActive || !implied || totalDebt === 0n) return;
  const market = markets.find((m) => m.id === active);
  if (!market || market.resolved) return;
  const already = await testnet.readContract({ ...pool, functionName: "hedgeShares", args: [active] });
  if (already > 0n) return;
  await send(scope, `${symbol} pool buys gap cover on #${active} (loans ${formatUnits(totalDebt, 6)} USDG)`, {
    ...pool,
    functionName: "hedge",
    args: [active],
  });
}

/** Settles every stock's markets after the reopen, then collects winnings and the maker's residual. */
async function settleAndCollect(markets: Market[]) {
  for (const m of markets) {
    if (!m.symbol || m.resolved || m.reopenTs > now()) continue;
    const round = await settlementRound(m.symbol, m.reopenTs);
    if (round === undefined) {
      log(scope, `${m.symbol} market #${m.id} waiting for the first post-reopen feed round`);
      continue;
    }
    await send(scope, `settle ${m.symbol} market #${m.id} with round ${round}`, {
      ...contracts.market,
      functionName: "resolve",
      args: [m.id, round],
    });
  }

  for (const m of await recentMarkets()) {
    if (!m.resolved || !m.symbol) continue;
    const { pool } = stockContracts(m.symbol);
    const winningToken = (m.id << 8n) | BigInt(m.winner);
    const [held, poolHeld] = await Promise.all([
      testnet.readContract({ ...contracts.market, functionName: "balanceOf", args: [account.address, winningToken] }),
      testnet.readContract({ ...contracts.market, functionName: "balanceOf", args: [pool.address, winningToken] }),
    ]);
    if (poolHeld > 0n) {
      await send(scope, `${m.symbol} pool collects ${formatUnits(poolHeld, 18)} USDG of cover from #${m.id}`, {
        ...pool,
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
  const closeTs = await currentClosure();
  if (closeTs !== undefined) {
    const markets = await recentMarkets();
    for (const symbol of STOCK_SYMBOLS) await openIfNeeded(markets, symbol, closeTs);
    const refreshed = await recentMarkets();
    for (const symbol of STOCK_SYMBOLS) {
      await pointOracle(refreshed, symbol, closeTs);
      await hedgePool(refreshed, symbol);
    }
  }
  await settleAndCollect(await recentMarkets());
}
