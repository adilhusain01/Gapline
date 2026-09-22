import { contracts, testnet } from "./chain";

export type Market = {
  id: bigint;
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
export async function recentMarkets(limit = 10): Promise<Market[]> {
  const count = await testnet.readContract({ ...contracts.market, functionName: "marketCount" });
  const ids = Array.from({ length: Math.min(Number(count), limit) }, (_, i) => count - 1n - BigInt(i));
  const raw = await Promise.all(ids.map((id) => testnet.readContract({ ...contracts.market, functionName: "getMarket", args: [id] })));
  return raw.map((m, i) => ({
    id: ids[i],
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

/** First mirrored round published at or after `reopenTs`, if the relayer has posted one yet. */
export async function settlementRound(reopenTs: bigint) {
  let id = await testnet.readContract({ ...contracts.feed, functionName: "latestRound" });
  let candidate: bigint | undefined;
  for (let steps = 0; id > 0n && steps < 200; steps++, id--) {
    const [, , , updatedAt] = await testnet.readContract({ ...contracts.feed, functionName: "getRoundData", args: [id] });
    if (updatedAt < reopenTs) break;
    candidate = id;
  }
  return candidate;
}
