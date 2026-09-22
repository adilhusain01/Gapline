/** Pre-flight: print the weekend BTC move and the belief the agent would trade toward. */
import { beliefFor } from "../src/belief";
import { config } from "../src/config";
import { weekendCryptoMovePct } from "../src/signals";

const closeTs = BigInt(process.argv[2] ?? 1789776000); // default: Fri 2026-09-18 20:00 EDT
const move = await weekendCryptoMovePct(closeTs);
const belief = beliefFor(config.edgesBps, move);
console.log(`BTC move since ${new Date(Number(closeTs) * 1000).toISOString()}: ${move.toFixed(2)}%`);
console.log(`belief mean ${belief.meanPct.toFixed(2)}%, sd ${belief.sigmaPct}%`);
console.log(`range probabilities: ${belief.probabilities.map((p) => `${(p * 100).toFixed(1)}%`).join("  ")}`);
