import { type StockSymbol, stockByFeed } from "@gapline/abi";

import { contracts, stockContracts, testnet } from "./chain";

export type Market = {
  id: bigint;
  feed: `0x${string}`;
  /** The stock whose mirrored feed the market settles on; undefined for markets on unknown feeds. */
  symbol: StockSymbol | undefined;
  creator: `0x${string}`;
  closeTs: bigint;
  reopenTs: bigint;
  refPrice: bigint;
  liquidity: bigint;
  boundariesBps: readonly bigint[];
  collateralHeld: bigint;
  feesAccrued: bigint;
  resolved: boolean;
  winner: number;
};

/** The most recent markets, newest first. */
export async function recentMarkets(limit = 12): Promise<Market[]> {
  const count = await testnet.readContract({ ...contracts.market, functionName: "marketCount" });
  const ids = Array.from({ length: Math.min(Number(count), limit) }, (_, i) => count - 1n - BigInt(i));
  const raw = await Promise.all(ids.map((id) => testnet.readContract({ ...contracts.market, functionName: "getMarket", args: [id] })));
  return raw.map((m, i) => ({
    id: ids[i],
    feed: m.feed,
    symbol: stockByFeed(m.feed)?.symbol,
    creator: m.creator,
    closeTs: BigInt(m.closeTs),
    reopenTs: BigInt(m.reopenTs),
    refPrice: m.refPrice,
    liquidity: m.liquidity,
    boundariesBps: m.boundariesBps,
    collateralHeld: m.collateralHeld,
    feesAccrued: m.feesAccrued,
    resolved: m.resolved,
    winner: Number(m.winner),
  }));
}

/** First round of `symbol`'s mirrored feed published at or after `reopenTs`, if the relayer has posted one yet. */
export async function settlementRound(symbol: StockSymbol, reopenTs: bigint) {
  const { feed } = stockContracts(symbol);
  let id = await testnet.readContract({ ...feed, functionName: "latestRound" });
  let candidate: bigint | undefined;
  for (let steps = 0; id > 0n && steps < 200; steps++, id--) {
    const [, , , updatedAt] = await testnet.readContract({ ...feed, functionName: "getRoundData", args: [id] });
    if (updatedAt < reopenTs) break;
    candidate = id;
  }
  return candidate;
}
