# AGENTS.md

Guidance for any coding agent (and new teammates) working in this repository. Keep it current: when a
contract, address, process, measured fact or decision changes, update this file, `README.md`, `docs/` and the
knowledge graph (`docs/knowledge-graph.md` and `docs/knowledge-graph.json`) in the same commit.

## What this is

Gapline prices the weekend gap in tokenized stocks on Robinhood Chain. While a stock's Chainlink feed is frozen
(weekends, NYSE holidays, corporate-action pauses) a USDG-collateralized LMSR market prices where the stock
reopens; an oracle turns that into a price and confidence band behind `AggregatorV3Interface`; a demo lending
pool consumes the band. Built for the Arbitrum Open House Singapore buildathon (HackQuest), submissions close
**Oct 4, 2026**. Everything runs on **Robinhood Chain testnet (chain id 46630)**.

## Layout

| Path | What | Stack |
|---|---|---|
| `contracts/` | MarketCalendar, MirroredFeed, GapMarket, ImpliedPriceOracle, GapGuardedLendingPool; tests; deploy script | Foundry, Solidity 0.8.30, via-IR, OpenZeppelin 5.7, Chainlink, PRBMath 4.2, BokkyPooBah DateTime |
| `contracts/deployments/46630.json` | Source of truth for deployed addresses | written by `script/Deploy.s.sol` |
| `packages/abi` | Typed ABIs + addresses, generated from the Foundry build | `@wagmi/cli` foundry plugin, viem chains |
| `apps/relayer` | Copies every mainnet RHTSLA/USD round to the testnet MirroredFeed | viem, tsx |
| `apps/agent` | Keeper (open, point oracle, settle, redeem, sweep) + pricing agent with hard caps; optional Claude analyst | viem, @anthropic-ai/sdk, zod, @stdlib normal cdf |
| `apps/web` | Market and Borrow pages | TanStack Router + Query, wagmi 3 (injected connector), shadcn/ui (radix-nova), zustand, Tailwind v4 |
| `ecosystem.config.cjs` | pm2: `awake` (caffeinate), `relayer`, `agent`, `web` (port 4173) | pm2 |
| `docs/` | `DEMO.md` (weekend runbook, pitch, submission text), knowledge graph | |

## Commands

```bash
# contracts
cd contracts && forge test                                   # unit + fuzz (fork test skips without a fork)
forge test --match-contract ForkedWeekend --fork-url robinhood_testnet
forge script script/Deploy.s.sol --rpc-url robinhood_testnet --private-key $PRIVATE_KEY --broadcast \
  --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/

# after any contract or address change
npm run abi                                                   # regenerates packages/abi/src/generated.ts

# services
npx pm2 start ecosystem.config.cjs && npx pm2 logs            # logs also in logs/*.log
npm run signal -w @gapline/agent                              # print BTC + Uniswap signals and belief (pre-flight)
npm run backtest -w @gapline/agent                            # replay every past weekend, writes docs/backtest.md
npm run once -w @gapline/agent                                # one keeper + trader cycle
cd apps/web && npx tsc --noEmit && npm run build
```

Install dependencies from the repo root with `-w <workspace>`; installing inside a package folder does not
save workspace deps. npm blocks install scripts by default; `esbuild` is already approved.

## Conventions

- Prefer maintained packages and official CLIs over hand-written code (shadcn CLI, `forge install`, `@wagmi/cli`,
  OpenZeppelin, Chainlink). Frontend: TanStack Router + Query, shadcn/ui, Tailwind classes inline in JSX (never
  in .css files beyond the theme), zustand for client state, lucide icons (picked via `better-icons`), no emojis
  anywhere, one light/dark theme from `src/styles.css`.
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
  Chainlink docs: off-hours the feed "may hold the last published price" and has "no heartbeats during off-hours".
- Observed weekends: last print lands Friday afternoon ET; the **first print after every closure lands exactly at
  Sunday 20:00 ET** (Mon 00:00 UTC; Tue 00:00 UTC after Labor Day). Frozen 52 to 78 h; gaps +0.05%, -1.09%, +0.38%.
- `GapMarket.resolve` only accepts a round within 6 h after the reopen (`MAX_SETTLE_DELAY`).
- `createMarket` needs the feed's last update at or before the close and no more than 3 days older than it.
- `oraclePaused()` (corporate actions) was not found on the feed or token contracts; the oracle treats a stale
  feed during market hours as frozen instead.
- Faucet (`faucet.testnet.chain.robinhood.com`) dispenses 0.01 ETH, 100 USDG and 5 each of TSLA, AMZN, AMD, NFLX,
  PLTR. It does not dispense NVDA, which is why the demo uses TSLA.
- Foundry does not know chain 46630 in `[etherscan]`; pass `--verifier blockscout --verifier-url` on the CLI.
- `shadcn init` is interactive even with flags; `components.json` is hand-written and the theme CSS was copied from
  a reference project generated by `shadcn create -t vite -b radix -p nova`.
- Robinhood Chain supports Stylus (Arbitrum Orbit).
- Mainnet TSLA stock token `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` ("Tesla • Robinhood Token", 18 dec) trades
  24/7 on Uniswap. Deepest v3 pool TSLA/USDG `0xf4ACdAEEB7022862A763C9B1B885e11191c889E3` (0.3%, ~$660K); v4 pools
  hold more (~$830K) but need StateView to read. Found via the DexScreener API (mainnet Blockscout is behind a
  Cloudflare challenge).
- The public mainnet RPC keeps no historical state (`historical state ... is not available`) but serves logs;
  wide `eth_getLogs` ranges time out, so query in <= 5,000-block chunks. Past pool prices come from Swap events.
- Backtest (docs/backtest.md, 13 closures, 9 with pool data): MAE no-change 0.67 pp, BTC x 0.35 0.51 pp, DEX 0.45 pp,
  50/50 blend 0.39 pp; DEX direction right 6/7; actual gap RMS 0.80%. Agent uses beta 0.35, sd 0.75%, blend 0.5,
  ranges -300/-100/-25/25/100/300 bps.

## Operating the weekend

See `docs/DEMO.md`. The relayer must run through Friday's close (the market's reference price is the last
mirrored round) and through Sunday 20:00 ET (settlement needs the reopening round). The agent opens the market
within a minute of the close and settles within a minute of the reopening round.
