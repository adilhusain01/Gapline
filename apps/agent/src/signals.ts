import { MAINNET_BTC_FEED, mainnet } from "./chain";

const PHASE_MASK = (1n << 64n) - 1n;

async function round(roundId: bigint) {
  const [, answer, , updatedAt] = await mainnet.readContract({
    ...MAINNET_BTC_FEED,
    functionName: "getRoundData",
    args: [roundId],
  });
  return { answer, updatedAt };
}

/** Last BTC price published at or before `timestamp`, found by binary search over the current phase. */
async function btcPriceAt(timestamp: bigint) {
  const [latestId] = await mainnet.readContract({ ...MAINNET_BTC_FEED, functionName: "latestRoundData" });
  const phase = latestId & ~PHASE_MASK;
  let hi = latestId & PHASE_MASK;
  let lo = hi > 5000n ? hi - 5000n : 1n;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    const { updatedAt } = await round(phase | mid);
    if (updatedAt <= timestamp) lo = mid;
    else hi = mid - 1n;
  }
  return round(phase | lo);
}

/**
 * BTC's move since the stock session closed, in percent, up to `until` (default: now).
 * Crypto trades all weekend; stocks don't.
 */
export async function weekendCryptoMovePct(closeTs: bigint, until?: bigint) {
  const [latest, atClose] = await Promise.all([
    until === undefined
      ? mainnet.readContract({ ...MAINNET_BTC_FEED, functionName: "latestRoundData" }).then(([, answer]) => answer)
      : btcPriceAt(until).then((round) => round.answer),
    btcPriceAt(closeTs),
  ]);
  if (atClose.answer <= 0n) return 0;
  return (Number(latest - atClose.answer) / Number(atClose.answer)) * 100;
}
