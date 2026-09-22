# Knowledge graph

Generated from `knowledge-graph.json` by `npm run kg` (last updated 2026-09-23). Edit the JSON, not this file.

```mermaid
flowchart LR
  Gapline(("Gapline"))
  MarketCalendar["MarketCalendar"]
  MirroredFeed["MirroredFeed"]
  GapMarket["GapMarket"]
  ImpliedPriceOracle["ImpliedPriceOracle"]
  GapGuardedLendingPool["GapGuardedLendingPool"]
  Relayer(["Relayer"])
  Agent(["Agent"])
  Web_app(["Web app"])
  Chainlink_RHTSLA_USD_mainnet[/"Chainlink RHTSLA/USD mainnet"/]
  Chainlink_WBTC_USD_mainnet[/"Chainlink WBTC/USD mainnet"/]
  USDG_testnet[/"USDG testnet"/]
  TSLA_testnet_token[/"TSLA testnet token"/]
  Deployer_wallet{{"Deployer wallet"}}
  Decision__v2_before_the_live_weekend>"Decision: v2 before the live weekend"]
  Decision__MirroredFeed_instead_of_Chainlink_mock>"Decision: MirroredFeed instead of Chainlink mock"]
  Uniswap_TSLA_USDG_v3_pool[/"Uniswap TSLA/USDG v3 pool"/]
  Backtest[("Backtest")]
  Decision__fitted_agent_parameters>"Decision: fitted agent parameters"]
  Decision__underwriter_fee_and_pool_hedge>"Decision: underwriter fee and pool hedge"]
  Weekend_rehearsal[("Weekend rehearsal")]
  GapMarket -->|reads session state from| MarketCalendar
  GapMarket -->|snapshots reference and settles from| MirroredFeed
  GapMarket -->|is collateralized in| USDG_testnet
  ImpliedPriceOracle -->|derives weekend price from| GapMarket
  ImpliedPriceOracle -->|passes through when live| MirroredFeed
  ImpliedPriceOracle -->|detects closures with| MarketCalendar
  GapGuardedLendingPool -->|prices collateral with| ImpliedPriceOracle
  GapGuardedLendingPool -->|accepts as collateral| TSLA_testnet_token
  GapGuardedLendingPool -->|lends| USDG_testnet
  Relayer -->|reads| Chainlink_RHTSLA_USD_mainnet
  Relayer -->|writes| MirroredFeed
  Agent -->|opens, trades, settles| GapMarket
  Agent -->|points at deepest market| ImpliedPriceOracle
  Agent -->|reads weekend signal from| Chainlink_WBTC_USD_mainnet
  Web_app -->|trades and settles| GapMarket
  Web_app -->|deposits and borrows| GapGuardedLendingPool
  Deployer_wallet -->|owns| MirroredFeed
  Gapline -->|follows| Decision__v2_before_the_live_weekend
  MirroredFeed -->|exists because of| Decision__MirroredFeed_instead_of_Chainlink_mock
  Agent -->|reads weekend price from| Uniswap_TSLA_USDG_v3_pool
  Backtest -->|replays swap logs of| Uniswap_TSLA_USDG_v3_pool
  Backtest -->|scores forecasts against| Chainlink_RHTSLA_USD_mainnet
  Agent -->|follows| Decision__fitted_agent_parameters
  GapGuardedLendingPool -->|buys weekend cover on| GapMarket
  Agent -->|calls hedge and collectHedge on| GapGuardedLendingPool
  GapMarket -->|implements| Decision__underwriter_fee_and_pool_hedge
  Weekend_rehearsal -->|exercises| Agent
  Weekend_rehearsal -->|screenshots| Web_app
  Weekend_rehearsal -->|verifies hedge payout of| GapGuardedLendingPool
```

## Projects

### Gapline

- Prices the weekend gap in tokenized stocks on Robinhood Chain with a USDG-settled LMSR market
- Built for Arbitrum Open House Singapore online buildathon; submissions close 2026-10-04
- Targets the Robinhood Chain reserved prize and the Paxos USDG bonus
- Live weekend demo: Fri 2026-09-25 20:00 ET close to Sun 2026-09-27 20:00 ET reopen

## Contracts

### MarketCalendar

- Testnet address 0x4897cA16aF49F84D689b59Be81abD9C0C760280f (v2 deployment), verified
- Trading day D runs 20:00 ET on D-1 to 20:00 ET on D; open when D is a weekday and not a holiday
- Handles US daylight time; owner sets NYSE full-day holidays (preloaded through 2027)
- No nextClose view: the web app reads the next 8 sessionStart boundaries and takes the first closed one
- 7 tests including a 1,000-run fuzz over 2026-2030

### MirroredFeed

- Testnet address 0x284a56BFBa8D03b662A23f4788bD458f835058f5 (v2 deployment), verified, RHTSLA / USD (mainnet mirror)
- Owner-only AggregatorV3Interface; owner is the relayer key
- Exists because Chainlink publishes Robinhood stock feeds on mainnet only

### GapMarket

- Testnet address 0x5f2d5F54e28002a9b06100532a1EE9B9ad5e479e (v2), verified; v1 0x44540A78c4006897109b33A60d89E4a5522CC4dB retired
- LMSR over reopening ranges; creator seeds b * ln(n) USDG; winning share redeems 1 USDG
- Outcome shares are ERC1155Supply tokens, tokenId = marketId << 8 | outcome
- resolve(marketId, roundId) needs the first round at or after reopen, within 6 h, predecessor before reopen
- v2: feeBps = 100 on every buy and sell to the creator (underwriter), claimable anytime via claimFees; quotes all-in
- 17 tests including a 1,000-run solvency fuzz with fees

### ImpliedPriceOracle

- Testnet address 0xeB246817d2440F82F4B4C04c2C120afEFe1E5EC4 (v2 deployment), verified
- Drop-in AggregatorV3Interface: live feed when fresh, market-implied mean and +/-2 sd band when frozen
- Frozen = session closed or feed older than 1 day during market hours
- setActiveMarket is permissionless but only the deepest market for the current closure, min depth 10 shares

### GapGuardedLendingPool

- Testnet address 0xBB924f325a7cDb1D53E514cB9691E3a19e26F6d1 (v2), verified, demo only; funded with 20 testnet USDG
- Borrow and withdraw priced at band low; liquidation requires unhealthy at band high
- Pauses both when the feed is frozen and no market prices it
- v2: hedge(marketId) buys worst-range cover paying 10% of totalDebt for at most 1% of it, once per market; collectHedge redeems
- Max LTV 50%, liquidation threshold 70%, bonus 5%

## Services

### Relayer

- apps/relayer, runs under pm2, logs/relayer.log
- Polls mainnet RHTSLA/USD every 15 s and mirrors every missed round in order with original timestamps

### Agent

- apps/agent, runs under pm2, logs/agent.log, ticks every 60 s
- Keeper: opens the closure market (depth 20, ranges -300/-100/-25/25/100/300 bps), points the oracle, has the pool hedge, settles, collects the pool's cover, redeems, withdraws residual, claims fees
- Pricing agent: normal belief, mean = 0.5 x Uniswap gap + 0.5 x (0.35 x weekend BTC move), sd 0.75%, plus optional Claude drift
- Uniswap signal ignored below $100K pool liquidity or beyond 10% from Friday's close
- Hard caps: 5 USDG per trade, 25 USDG net per market, never short, simulate before send
- Claude analyst is off until ANTHROPIC_API_KEY is set
- Follows chain time (syncClock each tick), since contracts judge sessions by block.timestamp

### Web app

- apps/web, TanStack Router + Query, wagmi 3 injected connector, shadcn radix-nova, zustand
- Served by pm2 at http://localhost:4173 (vite preview of the production build)
- Market page: ranges, trade panel, cost to move the implied price 1% (client-side LMSR), underwriter fees
- Borrow page: gap-aware pricing banner, Protect my loan (cover sized to 10/25/50% of debt), the pool's own cover
- Checked with Playwright screenshots on 2026-09-22 in weekday, Saturday (fork) and settled Monday (fork) states

## Externals

### Chainlink RHTSLA/USD mainnet

- 0x4A1166a659A55625345e9515b32adECea5547C38 on Robinhood Chain mainnet (4663), 8 decimals, us_equities_24/5
- Holds last price off-hours with no heartbeats
- First round after each closure lands exactly at Sunday 20:00 ET
- Frozen 52.2-77.8 h on the weekends of Sep 4, 11 and 18 2026; gaps +0.05%, -1.09%, +0.38%

### Chainlink WBTC/USD mainnet

- 0x62107b0d3adA75fc1697fD342d99eed947a3aA5E on Robinhood Chain mainnet; the agent's weekend signal

### USDG testnet

- Paxos Global Dollar 0x7E955252E15c84f5768B83c41a71F9eba181802F on Robinhood testnet, 6 decimals

### TSLA testnet token

- 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E, 18 decimals, dispensed by the Robinhood testnet faucet

### Uniswap TSLA/USDG v3 pool

- 0xf4ACdAEEB7022862A763C9B1B885e11191c889E3 on Robinhood Chain mainnet, 0.3% fee, ~$660K liquidity on 2026-09-23
- token0 TSLA stock token 0x322F0929c4625eD5bAd873c95208D54E1c003b2d, token1 USDG 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
- Trades through the weekend; historical prices come from Swap events because the public RPC has no archive state

## Accounts

### Deployer wallet

- 0x610FdB41DA83138615C317c89fd9EB09271a46fe, burner, key in git-ignored .env and considered exposed
- Relayer owner, market creator and agent trader on testnet
- Holds 80 USDG and 4 TSLA after funding the v2 pool with 20 USDG; 1 TSLA sits as collateral in the retired v1 pool

## Decisions

### Decision: v2 before the live weekend

- 2026-09-23: ship underwriter fee, pool auto-hedge, protection UI, cost-to-move display and DEX signal before Fri 2026-09-25
- Reason: Sep 25-28 is the only full live weekend before the Oct 4 deadline and its recording is the demo

### Decision: MirroredFeed instead of Chainlink mock

- MockV3Aggregator lets anyone write prices; on a public testnet that would let strangers settle markets

### Decision: fitted agent parameters

- 2026-09-23: beta 0.3 -> 0.35 (least squares), sd 2% -> 0.75%, 50/50 DEX+BTC blend, ranges tightened from +-0.5/2/5% to +-0.25/1/3%
- Reason: backtest showed gaps far smaller than assumed and the blend beat each signal alone

### Decision: underwriter fee and pool hedge

- 2026-09-23: v1 had no fee, so nobody would rationally underwrite; the pool was not a buyer of cover
- v2 adds a 1% trading fee to the market's creator and makes the lending pool buy its own weekend cover
- Answers the judge question 'who else trades this?': the protocol carrying the gap risk pays the underwriter

## Evidences

### Backtest

- docs/backtest.md, generated by npm run backtest -w @gapline/agent
- 13 weekend closures since late June 2026, 9 with Uniswap swap data
- MAE: no change 0.67 pp, BTC x 0.35 0.51 pp, DEX 0.45 pp, 50/50 blend 0.39 pp; DEX direction right 6 of 7
- Actual reopening gap RMS 0.80%

### Weekend rehearsal

- scripts/rehearse-weekend.sh: anvil fork of testnet, real agent, clock moved to the coming weekend
- Saturday: market opened, oracle pointed, pool bought cover (0.50 USDG payout for 0.07 USDG), trader bought 10.35 shares of -1% to -0.25%
- Sunday: settled on the reopening round, pool collected 0.50 USDG, residual withdrawn, 0.019 USDG fees claimed
- Surfaced six bugs fixed before the live weekend: agent wall-clock time, ambiguous range prices, UTC freeze label, stale oracle badge, settled-card label, session-close countdown
