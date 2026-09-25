# AGENTS.md

Guidance for any coding agent (and new teammates) working in this repository. Keep it current: when a
contract, address, process, measured fact or decision changes, update this file, `README.md`, `docs/` and the
knowledge graph (`docs/knowledge-graph.md` and `docs/knowledge-graph.json`) in the same commit.

## What this is

Gapline prices the weekend gap in tokenized stocks (TSLA and AMZN) on Robinhood Chain. While a stock's Chainlink feed is frozen
(weekends, NYSE holidays, corporate-action pauses) a USDG-collateralized LMSR market prices where the stock
reopens; an oracle turns that into a price and confidence band behind `AggregatorV3Interface`; a demo lending
pool consumes the band. Built for the Arbitrum Open House Singapore buildathon (HackQuest), submissions close
**Oct 4, 2026**. Everything runs on **Robinhood Chain testnet (chain id 46630)**.

## Layout

| Path | What | Stack |
|---|---|---|
| `contracts/` | MarketCalendar, MirroredFeed, GapMarket, ImpliedPriceOracle, GapGuardedLendingPool, ILmsrMath + LmsrMathSol (reference); tests; deploy and vector scripts | Foundry, Solidity 0.8.30, via-IR, OpenZeppelin 5.7, Chainlink, PRBMath 4.2, BokkyPooBah DateTime |
| `stylus/lmsr-math` | LmsrMath: LMSR cost/costDelta/prices as an Arbitrum Stylus program (PRBMath exp2/log2 ported to I256); PRBMath vectors; `scripts/parity_check.py`, `scripts/gas_bench.py` | Rust 1.88, stylus-sdk 0.10.9, alloy-primitives 1.5, cargo-stylus 0.10 |
| `contracts/deployments/46630.json` | Source of truth for deployed addresses: shared contracts at the top, per-stock under `stocks.<SYMBOL>` | written by `script/Deploy.s.sol` |
| `packages/abi` | Typed ABIs, `stocks` table (mainnet feed/token/Uniswap pool + testnet contracts per stock), `stockByFeed` | `@wagmi/cli` foundry plugin, viem chains |
| `apps/relayer` | Copies every mainnet RH<stock>/USD round to that stock's testnet MirroredFeed, one stock at a time | viem, tsx |
| `apps/agent` | Keeper (open, point oracle, hedge, settle, redeem, sweep) + pricing agent with hard caps, per stock; optional Claude analyst | viem, @anthropic-ai/sdk, zod, @stdlib normal cdf |
| `apps/web` | Landing page at `/` (weekend chart, live TSLA/AMZN strip, how a weekend runs, for lenders); dashboard at `/app` (Market) and `/app/borrow` (Borrow) with the stock picker in its header (zustand `stock`) | TanStack Router + Query, wagmi 3 (injected connector), shadcn/ui (radix-nova), zustand, Tailwind v4 |
| `ecosystem.config.cjs` | pm2: `awake` (caffeinate), `relayer`, `agent`, `web` (port 4173) | pm2 |
| `docs/` | `DEMO.md` (weekend runbook, pitch, submission text), knowledge graph | |

## Commands

```bash
# contracts
cd contracts && forge test                                   # unit + fuzz (fork test skips without a fork)
STOCK=AMZN forge test --match-contract ForkedWeekend --fork-url robinhood_testnet   # default STOCK=TSLA
LMSR_MATH=<stylus address> forge script script/Deploy.s.sol --rpc-url robinhood_testnet --private-key $PRIVATE_KEY \
  --broadcast --slow --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/
forge script script/LmsrVectors.s.sol                         # regenerate PRBMath vectors for the Stylus tests

# stylus (cd stylus/lmsr-math)
cargo test --lib                                              # port vs 1,048 PRBMath vectors (not plain cargo test)
cargo stylus check --endpoint https://rpc.testnet.chain.robinhood.com
cargo stylus deploy --endpoint https://rpc.testnet.chain.robinhood.com --private-key $PRIVATE_KEY
python3 scripts/parity_check.py                               # deployed program vs the vectors (must be 240/240)
python3 scripts/gas_bench.py                                  # Stylus vs LmsrMathSol gas on the live chain

# after any contract or address change
npm run abi                                                   # regenerates packages/abi/src/generated.ts

# services
npx pm2 start ecosystem.config.cjs && npx pm2 logs            # logs also in logs/*.log
npm run signal -w @gapline/agent                              # print BTC + Uniswap signals and belief per stock (pre-flight)
npm run backtest -w @gapline/agent -- AMZN                    # replay every past weekend, writes docs/backtest-<SYMBOL>.md
npm run once -w @gapline/agent                                # one keeper + trader cycle
scripts/rehearse-weekend.sh [TSLA_GAP] [AMZN_GAP]             # full weekend for both stocks on an anvil fork, real agent
cd apps/web && npx tsc --noEmit && npm run build
```

Install dependencies from the repo root with `-w <workspace>`; installing inside a package folder does not
save workspace deps. npm blocks install scripts by default; `esbuild` is already approved.

## Conventions

- Prefer maintained packages and official CLIs over hand-written code (shadcn CLI, `forge install`, `@wagmi/cli`,
  OpenZeppelin, Chainlink). Frontend: TanStack Router + Query, shadcn/ui, Tailwind classes inline in JSX (never
  in .css files beyond the theme), zustand for client state, lucide icons (picked via `better-icons`), no emojis
  anywhere, one light/dark theme from `src/styles.css`.
- Live data refreshes in place, never the whole page: skeletons only on a query's first load; a read whose
  arguments move keeps its last result (`placeholderData: keepPreviousData`, or `keepWithinStock` in
  `lib/gapline.ts` for per-stock reads so one stock's numbers never show under another); reads that take "now"
  key on `useNow(step)` from `lib/clock.ts`, never `Date.now()` in render; ticking times are the `Countdown` and
  `TimeAgo` components, which re-render only themselves.
- Wallet: wagmi's default localStorage storage plus `reconnectOnMount` keep the wallet connected across reloads;
  `ConnectButton` shows "Reconnecting" meanwhile and lists EIP-6963 wallets when several are installed. Providers
  sit in the root route so the landing page and the dashboard share one connection.
- Visual identity ("after hours"): navy background in dark mode, cool paper in light, amber (`--band`) for the
  gap range and primary actions, slate (`--frozen`) for the frozen Chainlink line; IBM Plex Sans for text and
  IBM Plex Mono for prices only (`@fontsource`), all set in the theme. The landing page's one bold element is
  the weekend chart (`components/weekend-chart.tsx`); keep the rest plain: no card grids, stat rows, all-caps
  labels or arrows on buttons.
- Adding a stock: add it to `stocks()` in `Deploy.s.sol` and `MAINNET_STOCKS` in `packages/abi/src/index.ts`
  (mainnet feed, token, deepest Uniswap v3 USDG pool with the stock as token0), deploy, `npm run abi`, run its
  backtest and add its fit to `stockOverrides` in `apps/agent/src/config.ts`. Everything else loops over stocks.
- Contracts: custom errors, NatSpec on external functions, OpenZeppelin for tokens/guards, no hand-rolled math
  where PRBMath or OZ `Math` covers it. Every behavior change gets a unit test; money-handling changes get a fuzz
  or invariant test.
- Commits: conventional prefixes (`feat(contracts):`, `fix(agent):`, `docs:`), one logical change each.
- Never commit `.env` or anything under `logs/`. The deployer key in `.env` is a public-testnet burner and is
  considered exposed; never fund it with real assets.

## Facts that shape the code (measured, keep updated)

- Chainlink publishes Robinhood stock feeds on **mainnet only** (`reference-data-directory ... feeds-robinhood-mainnet.json`).
  Testnet uses `MirroredFeed`, owner-only, fed by the relayer with original mainnet timestamps.
- Mainnet RHTSLA/USD: `0x4A1166a659A55625345e9515b32adECea5547C38`, 8 decimals, marked `us_equities_24/5`, 24 h heartbeat.
  RHAMZN/USD: `0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C`, same schedule.
  Chainlink docs: off-hours the feed "may hold the last published price" and has "no heartbeats during off-hours".
- Observed weekends: last print lands Friday afternoon ET; the **first print after every closure lands exactly at
  Sunday 20:00 ET** (Mon 00:00 UTC; Tue 00:00 UTC after Labor Day). Frozen 52 to 78 h; gaps +0.05%, -1.09%, +0.38%.
- `GapMarket.resolve` only accepts a round within 6 h after the reopen (`MAX_SETTLE_DELAY`).
- v2 (deployed 2026-09-22): `GapMarket` charges `feeBps` (100) on every buy and sell, paid to the market's creator
  via `claimFees`; quotes are all-in. `GapGuardedLendingPool.hedge(marketId)` buys worst-range cover worth 10% of
  `totalDebt` for at most 1% of it, once per market, only on the oracle's active market; `collectHedge` redeems.
  v1 addresses are retired; the 20 USDG left in the v1 pool was recovered by borrowing against 1 TSLA.
- v3 (deployed 2026-09-23, addresses in `deployments/46630.json` and README): one `GapMarket` and calendar for all
  stocks, pricing through `ILmsrMath` at the Stylus program `0x4B4909452B47daEaD2303d2072D74C5474E00178`; a feed,
  oracle and pool per stock (TSLA, AMZN), each pool funded with 10 USDG. v2 (GapMarket `0x5f2d...479e`, pool
  `0xBB92...F6d1`) is retired; its 20 USDG was recovered the same way. Deploy with `MIN_LIQUIDITY=10e18`, so a
  depth-10 market can drive an oracle.
- Stylus on Robinhood Chain testnet: ArbWasm version 3, activation fee ~0.0001 ETH for the 19.5 KB program. The
  Stylus cache is **not** enabled (`ArbWasmCache` has no cache managers, `cargo stylus cache bid` fails), so every
  call pays the uncached init of 23,337 gas (5,141 cached, from `ArbWasm.programInitGas`). Measured vs
  `LmsrMathSol` (`0x8223BBbe2d37e9623faE882888A97C55E2F95BFB`): `costDelta` +50% at 2 ranges, +6% at 7, -21% at
  16; per extra range ~4.2K vs ~9.1K gas. `opt-level "z"` only shrinks it to 18.8 KB. Anvil and forge forks cannot
  run Stylus WASM (code starts `0xEFF000`): fork tests and the rehearsal etch `LmsrMathSol` over the address.
- Sharing the web app over Tailscale: `vite preview` listens on `localhost` only (`[::1]` on Linux), so proxy
  `http://localhost:4173`, not `127.0.0.1`; `preview.allowedHosts` admits `*.ts.net` (Vite rejects unknown Host
  headers). A machine that only serves the web app runs `pm2 start ecosystem.config.cjs --only web` (`awake` is
  macOS `caffeinate`). Run the relayer and agent on exactly one machine: they share the deployer key.
- `cast` parses negative numbers as flags: put options before `--` and arguments after it.
- `createMarket` needs the feed's last update at or before the close and no more than 3 days older than it.
- `oraclePaused()` (corporate actions) was not found on the feed or token contracts; the oracle treats a stale
  feed during market hours as frozen instead.
- Faucet (`faucet.testnet.chain.robinhood.com`) dispenses 0.01 ETH, 100 USDG and 5 each of TSLA, AMZN, AMD, NFLX,
  PLTR. It does not dispense NVDA, which is why the demo uses TSLA and AMZN. The budget for both stocks from one
  claim: two depth-10 seeds (19.46 USDG each), 10 USDG per pool, the agent's 10 USDG cap per market.
- Foundry does not know chain 46630 in `[etherscan]`; pass `--verifier blockscout --verifier-url` on the CLI.
- `shadcn init` is interactive even with flags; `components.json` is hand-written and the theme CSS was copied from
  a reference project generated by `shadcn create -t vite -b radix -p nova`.
- Mainnet TSLA stock token `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` ("Tesla • Robinhood Token", 18 dec) trades
  24/7 on Uniswap. Deepest v3 pool TSLA/USDG `0xf4ACdAEEB7022862A763C9B1B885e11191c889E3` (0.3%, ~$660K); v4 pools
  hold more (~$830K) but need StateView to read. Found via the DexScreener API (mainnet Blockscout is behind a
  Cloudflare challenge). AMZN token `0x12f190a9F9d7D37a250758b26824B97CE941bF54`, AMZN/USDG v3 pool
  `0x8AC92DA74AB5F3b1d024Dc1943Ad7e15Dc4179Ef` (0.3%, ~$869K, AMZN is token0 like TSLA).
- The public mainnet RPC keeps no historical state (`historical state ... is not available`) but serves logs;
  wide `eth_getLogs` ranges time out, so query in <= 5,000-block chunks. Past pool prices come from Swap events.
- Backtest TSLA (docs/backtest-TSLA.md, 13 closures, 9 with pool data): MAE no-change 0.67 pp, BTC x 0.35 0.51 pp,
  DEX 0.45 pp, 50/50 blend 0.39 pp; DEX direction right 6/7; actual gap RMS 0.80%; fitted beta 0.34. Agent uses
  beta 0.35, sd 0.75%, blend 0.5, ranges -300/-100/-25/25/100/300 bps.
- Backtest AMZN (docs/backtest-AMZN.md): MAE no-change 0.60 pp, BTC x 0.20 0.55 pp, DEX 0.28 pp, 0.7 DEX blend 0.30 pp
  (RMS 0.34, the lowest); DEX direction 6/8; gap RMS 0.60%; fitted beta 0.20. Agent uses beta 0.20, sd 0.55%, blend 0.7.
- Agent defaults (v3): depth 10, 3 USDG per trade, 10 USDG net per market. It trades the largest disagreement it
  can act on (buys, or sells of shares it holds); before v3 it skipped the tick when that was an unheld sell.

- The agent follows **chain time**, not the laptop clock: `syncClock()` reads the latest block each tick, because the
  contracts decide open/closed and settlement windows with `block.timestamp`.
- `TESTNET_RPC_URL` (agent) and `VITE_TESTNET_RPC_URL` (web) point at a fork for rehearsals; unset means the public RPC.
  Never ship a web build made with the fork variable (check `apps/web/dist` does not contain `localhost:8547`).
- Weekend rehearsal (2026-09-22, `scripts/rehearse-weekend.sh`): open market, point oracle, pool hedge, trade on
  Saturday; settle, collect cover (+0.50 USDG on a -3.5% reopen for 0.07 USDG premium), withdraw residual and claim
  fees on Sunday, all by the real agent against the v2 contracts. It surfaced six UI and agent bugs, all fixed.
  Rerun 2026-09-23 on v3 for both stocks (TSLA -3.5%, AMZN +0.8%): both markets opened, oracles pointed, both
  pools hedged; TSLA's pool collected 0.25 USDG of cover; residuals and fees collected on both.

## Operating the weekend

See `docs/DEMO.md`. The relayer must run through Friday's close (the market's reference price is the last
mirrored round) and through Sunday 20:00 ET (settlement needs the reopening round). The agent opens every stock's
market within a minute of the close and settles each within a minute of its reopening round.
