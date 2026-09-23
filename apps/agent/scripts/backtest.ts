/**
 * Backtest: for every weekend closure in a stock's mainnet Chainlink feed history, compare three forecasts of the
 * reopening gap against the actual first print after the reopen:
 *   - "no change"  the frozen feed's implicit forecast,
 *   - "BTC x beta" the weekend BTC move times the configured beta,
 *   - "DEX"        the Uniswap <stock>/USDG price one hour before the reopen,
 *   - "blend"      the agent's live forecast: dexWeight x DEX + (1 - dexWeight) x BTC.
 * It also prints the least-squares BTC beta and the blend's residual RMS, which set the stock's config.
 * Writes docs/backtest-<symbol>.md. Run: npm run backtest -w @gapline/agent -- AMZN   (default TSLA)
 */
import { writeFileSync } from "node:fs";
import { STOCK_SYMBOLS, type StockSymbol, aggregatorV3InterfaceAbi, stocks } from "@gapline/abi";

import { mainnet } from "../src/chain";
import { stockConfig } from "../src/config";
import { dexPriceAt } from "../src/dex";
import { weekendCryptoMovePct } from "../src/signals";

const symbol = (process.argv[2] ?? "TSLA").toUpperCase() as StockSymbol;
if (!STOCK_SYMBOLS.includes(symbol)) throw new Error(`unknown stock ${symbol}; one of ${STOCK_SYMBOLS.join(", ")}`);
const stock = stocks[symbol];
const config = stockConfig(symbol);
const PHASE = 1n << 64n;
const feed = { address: stock.feed, abi: aggregatorV3InterfaceAbi } as const;

type Round = { id: bigint; price: number; at: bigint };

async function allRounds(): Promise<Round[]> {
  const [latestId] = await mainnet.readContract({ ...feed, functionName: "latestRoundData" });
  const last = latestId - PHASE;
  const ids = Array.from({ length: Number(last) }, (_, i) => PHASE + BigInt(i + 1));
  const rounds: Round[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await Promise.all(
      ids.slice(i, i + 50).map(async (id) => {
        const [, answer, , updatedAt] = await mainnet.readContract({ ...feed, functionName: "getRoundData", args: [id] });
        return { id, price: Number(answer) / 1e8, at: updatedAt };
      }),
    );
    rounds.push(...batch);
  }
  return rounds.filter((r) => r.at > 0n);
}

const pct = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`;
const utc = (t: bigint) => new Date(Number(t) * 1000).toISOString().slice(0, 16).replace("T", " ");

const rounds = await allRounds();
// A closure is any gap of more than 30 hours between consecutive rounds.
const closures = rounds
  .slice(1)
  .map((r, i) => ({ before: rounds[i], after: r }))
  .filter(({ before, after }) => after.at - before.at > 30n * 3600n);

const rows: string[] = [];
const samples: { actual: number; move: number; btc: number; dex?: number }[] = [];
let directionHits = 0;
let directionCases = 0;

for (const { before, after } of closures) {
  const actual = (after.price / before.price - 1) * 100;
  const signalAt = after.at - 3600n;
  const [dex, btcMove] = await Promise.all([dexPriceAt(symbol, signalAt), weekendCryptoMovePct(before.at, signalAt)]);
  const btcForecast = config.btcBeta * btcMove;
  const dexForecast = dex ? (dex.price / before.price - 1) * 100 : undefined;

  samples.push({ actual, move: btcMove, btc: btcForecast, dex: dexForecast });
  if (dexForecast !== undefined) {
    if (Math.abs(actual) >= 0.25) {
      directionCases++;
      if (Math.sign(dexForecast) === Math.sign(actual)) directionHits++;
    }
  }
  rows.push(
    `| ${utc(before.at)} | $${before.price.toFixed(2)} | ${utc(after.at)} | $${after.price.toFixed(2)} | ${pct(actual)} | ` +
      `${pct(btcForecast)} | ${dex ? `$${dex.price.toFixed(2)} (${pct(dexForecast!)})` : "no swaps"} |`,
  );
  console.log(rows.at(-1));
}

const mae = (errs: number[]) => errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length;
const rms = (errs: number[]) => Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / errs.length);
const matched = samples.filter((s) => s.dex !== undefined);
// Regression through the origin of the actual gap on the weekend BTC move.
const fittedBeta = samples.reduce((a, s) => a + s.actual * s.move, 0) / samples.reduce((a, s) => a + s.move * s.move, 0);
const forecasts: [string, (s: (typeof samples)[number]) => number][] = [
  ["No change (what a frozen feed assumes)", () => 0],
  [`BTC move x ${config.btcBeta}`, (s) => s.btc],
  [`Uniswap ${symbol}/USDG, 1 h before reopen`, (s) => s.dex!],
  [`Blend ${config.dexWeight} DEX + ${Number((1 - config.dexWeight).toFixed(2))} BTC (agent's forecast)`, (s) => config.dexWeight * s.dex! + (1 - config.dexWeight) * s.btc],
];
const summary = [
  `| Forecast (same ${matched.length} weekends with DEX data) | Mean absolute error | RMS error |`,
  `|---|---|---|`,
  ...forecasts.map(([name, f]) => {
    const errs = matched.map((s) => s.actual - f(s));
    return `| ${name} | ${mae(errs).toFixed(2)} pp | ${rms(errs).toFixed(2)} pp |`;
  }),
  "",
  `Across all ${samples.length} closures, the actual reopening gap had an RMS of ${rms(samples.map((s) => s.actual)).toFixed(2)}%.`,
  `Least-squares beta of the gap on the weekend BTC move: ${fittedBeta.toFixed(2)} (config uses ${config.btcBeta}).`,
];

const doc = `# Backtest: forecasting the Sunday reopen of ${symbol}

Generated by \`npm run backtest -w @gapline/agent -- ${symbol}\` on ${new Date().toISOString().slice(0, 10)} from Robinhood Chain
mainnet: the Chainlink RH${symbol}/USD feed (\`${stock.feed}\`), Chainlink WBTC/USD, and swap logs of the Uniswap v3
${symbol}/USDG pool (\`${stock.usdgPool}\`). A closure is any gap of more than 30 hours between feed rounds.

${summary.join("\n")}

DEX direction called correctly on ${directionHits} of ${directionCases} weekends with a gap of at least 0.25%.

| Last print | Price | First print after | Price | Actual gap | BTC forecast | DEX 1 h before reopen |
|---|---|---|---|---|---|---|
${rows.join("\n")}

Small sample: this is every weekend closure since the feed's first round in late June 2026; the Uniswap pool has swap history from late July.
`;
writeFileSync(new URL(`../../../docs/backtest-${symbol}.md`, import.meta.url), doc);
console.log(`\n${summary.join("\n")}\nDEX direction ${directionHits}/${directionCases}`);
