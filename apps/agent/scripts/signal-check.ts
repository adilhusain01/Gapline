/**
 * Pre-flight: print the weekend signals and the belief the agent would trade toward, for every stock.
 * npm run signal -w @gapline/agent -- [closeTs]   (default: Fri 2026-09-18 20:00 EDT). Friday's close is read
 * from each stock's mainnet feed at closeTs.
 */
import { STOCK_SYMBOLS, aggregatorV3InterfaceAbi, stocks } from "@gapline/abi";

import { beliefFor } from "../src/belief";
import { mainnet } from "../src/chain";
import { stockConfig } from "../src/config";
import { dexSignal } from "../src/dex";
import { weekendCryptoMovePct } from "../src/signals";

const closeTs = BigInt(process.argv[2] ?? 1789776000);
const move = await weekendCryptoMovePct(closeTs);
console.log(`BTC move since ${new Date(Number(closeTs) * 1000).toISOString()}: ${move.toFixed(2)}%`);

/** Last feed price at or before closeTs, walking back from the latest round. */
async function closeAt(feed: `0x${string}`) {
  let [id, answer, , updatedAt] = await mainnet.readContract({ address: feed, abi: aggregatorV3InterfaceAbi, functionName: "latestRoundData" });
  while (updatedAt > closeTs) {
    id -= 1n;
    [, answer, , updatedAt] = await mainnet.readContract({ address: feed, abi: aggregatorV3InterfaceAbi, functionName: "getRoundData", args: [id] });
  }
  return Number(answer) / 1e8;
}

for (const symbol of STOCK_SYMBOLS) {
  const config = stockConfig(symbol);
  const fridayClose = await closeAt(stocks[symbol].feed);
  const dex = await dexSignal(symbol, fridayClose, config.minDexTvlUsd, config.maxDexDeviationPct);
  const belief = beliefFor(config, config.edgesBps, move, dex.usable ? dex.gapPct : undefined);
  console.log(`\n${symbol}: Friday close $${fridayClose.toFixed(2)}`);
  console.log(
    `  Uniswap ${symbol}/USDG $${dex.price.toFixed(2)} (${dex.gapPct.toFixed(2)}%), pool $${Math.round(dex.tvlUsd).toLocaleString()}, ${dex.usable ? "used" : "ignored"}`,
  );
  console.log(`  belief mean ${belief.meanPct.toFixed(2)}%, sd ${belief.sigmaPct}% (BTC beta ${config.btcBeta})`);
  console.log(`  range probabilities: ${belief.probabilities.map((p) => `${(p * 100).toFixed(1)}%`).join("  ")}`);
}
