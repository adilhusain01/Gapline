# Weekend run, demo recording and submission

Times are given in ET (the market's clock) and IST.

## Timeline for the weekend of Sep 25 - 28, 2026

| When (ET) | When (IST) | What happens | Who acts |
|---|---|---|---|
| Fri Sep 25, afternoon | Sat Sep 26, ~01:00 - 05:30 | Last Chainlink TSLA print of the week lands; relayer copies it | relayer |
| Fri Sep 25, 20:00 | Sat Sep 26, 05:30 | Session closes. Within a minute the agent opens market #0 and points the oracle at it | agent |
| Saturday | Saturday | Agent trades toward its BTC-based belief every minute; oracle reports the implied price | agent |
| Sun Sep 27, 20:00 | Mon Sep 28, 05:30 | Session reopens; Chainlink posts the reopening round; relayer copies it | relayer |
| Sun Sep 27, ~20:01 | Mon Sep 28, ~05:31 | Agent settles the market, redeems winners, withdraws the maker residual | agent |

Deadline is Oct 4, so the recording from this weekend is the submission video. The weekend of Oct 2 - 4 is
a fallback, but it ends on submission day, so treat this weekend as the real one.

## Pre-flight (Friday evening IST, before you sleep)

```bash
cd gapline
npx pm2 status                         # awake, relayer, agent, web all "online"
tail -3 logs/relayer.log               # recent "mirrored TSLA" lines, no repeated errors
tail -3 logs/agent.log                 # agent started, analyst on/off as intended
npm run signal -w @gapline/agent       # BTC signal and belief print without errors
cast balance 0x610FdB41DA83138615C317c89fd9EB09271a46fe --ether --rpc-url https://rpc.testnet.chain.robinhood.com
```

- Wallet needs at least 0.002 testnet ETH and 60 USDG (seed ~39 + trading cap 25). Top up from
  faucet.testnet.chain.robinhood.com and faucet.paxos.com if needed.
- Mac plugged in, lid open (the `awake` process blocks idle sleep, not lid-close sleep).
- Optional: put `ANTHROPIC_API_KEY=...` in `.env` and `npx pm2 restart agent` to turn on the news analyst.

If the Mac was asleep or offline at the close, nothing is lost: when the agent comes back it opens the
market for the current closure on its next tick. If the relayer missed rounds, it replays every mainnet
round it missed, in order.

## What to record

Record the browser at http://localhost:4173 with the explorer in a second tab.

**Saturday (market live), about 2 minutes**

1. Header pill reads "Gap-implied price". Price panel: implied TSLA price, the band, "reopens in".
2. Market card: the seven ranges with probabilities, "oracle source" badge. Point at the agent's trades in
   `logs/agent.log` next to the range bars moving.
3. Buy a range yourself (for example "-2% to -0.5%", 5 shares). Show the probability and the implied price move.
4. Borrow page: amber "Weekend pricing from the gap market" banner, borrow price below liquidation price.
   Deposit 1 TSLA, borrow a few USDG, show the position card.
5. Explorer: the GapMarket contract's recent transactions (market creation, trades) are all real testnet txs.

**Monday morning IST (after the reopen), about 1 minute**

1. Header back to "Market open"; price panel shows the live feed price.
2. Market card: "settled here" on the winning range, settle price, the reopening move.
3. Redeem any winning shares on camera.
4. Explorer: the settle transaction from the agent, and the MirroredFeed round it used, timestamped at
   Sunday 20:00 ET.

## Three-minute pitch

1. **Problem (30 s).** Tokenized stocks trade 24/7 on Robinhood Chain; their Chainlink feeds freeze for
   52 to 78 hours every weekend (show the README table). Chainlink's docs leave staleness to integrators.
   Every lender either stops or uses a stale price and eats the Monday gap.
2. **Product (45 s).** Gapline prices the closure: a USDG market on where the stock reopens, an oracle that
   turns it into a price and a confidence band behind the standard Chainlink interface, and a lending pool
   that borrows at the low end and liquidates only at the high end.
3. **Live demo (75 s).** The Saturday and Monday clips above.
4. **Why it is sound (30 s).** Automatic settlement from the first post-reopen Chainlink round, checked
   against its predecessor; LMSR solvency fuzzed over 1,000 random trade sequences; a forked full-weekend
   test against the deployed contracts; the agent trades inside hard caps. Mainnet needs one change: point
   at the real feed.

## Submission text

**Name:** Gapline

**Tagline:** A market-implied weekend price for tokenized stocks, settled in USDG on Robinhood Chain.

**Description:**
Tokenized stocks trade 24/7, but their Chainlink feeds freeze from Friday afternoon to Sunday 20:00 ET, 52 to
78 hours a week on Robinhood's own TSLA feed. Lending protocols either stop or price collateral at a stale
number and absorb Monday's gap. Gapline opens a USDG-collateralized LMSR market on where the stock reopens
for every closure, settles it permissionlessly from the first Chainlink round after the reopen, and turns
its probabilities into a live price and confidence band behind the standard AggregatorV3Interface. A demo
lending pool shows the payoff: borrowing is valued at the band's low end and liquidation requires the high
end, so thin weekend prints cannot liquidate anyone. An agent opens, prices, settles and collects each
weekend's market inside hard spending limits, optionally with a Claude news analyst.

**Built with:** Solidity, Foundry, OpenZeppelin, Chainlink, PRBMath, Robinhood Chain testnet, Paxos USDG,
viem, wagmi, TanStack, shadcn/ui, Anthropic Claude.

**Links:** repository, the explorer links in the README, and the demo video.
