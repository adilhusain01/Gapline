/** Pre-flight: print the weekend signals and the belief the agent would trade toward. */
import { beliefFor } from "../src/belief";
import { config } from "../src/config";
import { dexSignal } from "../src/dex";
import { weekendCryptoMovePct } from "../src/signals";

const closeTs = BigInt(process.argv[2] ?? 1789776000); // default: Fri 2026-09-18 20:00 EDT
const fridayClose = Number(process.argv[3] ?? 363.8); // that closure's last Chainlink print
const [move, dex] = await Promise.all([
  weekendCryptoMovePct(closeTs),
  dexSignal(fridayClose, config.minDexTvlUsd, config.maxDexDeviationPct),
]);
const belief = beliefFor(config.edgesBps, move, dex.usable ? dex.gapPct : undefined);
console.log(`BTC move since ${new Date(Number(closeTs) * 1000).toISOString()}: ${move.toFixed(2)}%`);
console.log(
  `Uniswap TSLA/USDG $${dex.price.toFixed(2)} (${dex.gapPct.toFixed(2)}% vs $${fridayClose}), pool $${Math.round(dex.tvlUsd).toLocaleString()}, ${dex.usable ? "used" : "ignored"}`,
);
console.log(`belief mean ${belief.meanPct.toFixed(2)}%, sd ${belief.sigmaPct}%`);
console.log(`range probabilities: ${belief.probabilities.map((p) => `${(p * 100).toFixed(1)}%`).join("  ")}`);
