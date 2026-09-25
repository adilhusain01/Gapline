# Weekend run, demo recording and submission

Times are given in ET (the market's clock) and IST.

## Timeline for the weekend of Sep 25 - 28, 2026

| When (ET) | When (IST) | What happens | Who acts |
|---|---|---|---|
| Fri Sep 25, afternoon | Sat Sep 26, ~01:00 - 05:30 | Last Chainlink TSLA and AMZN prints of the week land; relayer copies them | relayer |
| Fri Sep 25, 20:00 | Sat Sep 26, 05:30 | Session closes. Within a minute the agent opens a TSLA and an AMZN market (#0 and #1), points each oracle at its market and, if a pool has loans, buys that pool's cover | agent |
| Saturday | Saturday | Agent trades each market toward its Uniswap + BTC forecast every minute; both oracles report implied prices | agent |
| Sun Sep 27, 20:00 | Mon Sep 28, 05:30 | Session reopens; Chainlink posts the reopening rounds; relayer copies them | relayer |
| Sun Sep 27, ~20:01 | Mon Sep 28, ~05:31 | Agent settles both markets, collects the pools' cover, redeems winners, withdraws the residuals and claims fees | agent |

Deadline is Oct 4, so the recording from this weekend is the submission video. The weekend of Oct 2 - 4 is
a fallback, but it ends on submission day, so treat this weekend as the real one.

## Pre-flight (Friday evening IST, before you sleep)

```bash
cd gapline
npx pm2 status                         # relayer, agent, demo, web all "online" (on the VPS)
tail -3 logs/relayer.log               # recent "mirrored TSLA" / "mirrored AMZN" lines, no repeated errors
tail -3 logs/agent.log                 # agent started, analyst on/off as intended
npm run signal -w @gapline/agent       # BTC + Uniswap signals and belief for both stocks (Sep 18 closure)
cast balance 0x610FdB41DA83138615C317c89fd9EB09271a46fe --ether --rpc-url https://rpc.testnet.chain.robinhood.com
```

- Wallet needs at least 0.002 testnet ETH and 59 USDG (two seeds of 19.46 + the 10 USDG trading cap per
  market). On Sep 23 it held 80 USDG after funding both pools with 10 each. Top up from
  faucet.testnet.chain.robinhood.com and faucet.paxos.com if needed.
- Before Friday's close, open a small loan on each stock so each pool has something to insure: on the Borrow
  page pick TSLA, deposit 1 and borrow about 5 USDG; then the same for AMZN. The keeper sizes each pool's cover to
  its outstanding loans. (Each pool holds 110 USDG; the app caps each wallet at 5 USDG of debt per pool.)
- Friday afternoon, run the dress rehearsal once more: `scripts/rehearse-weekend.sh`. It plays the whole weekend
  for both stocks on a throwaway fork with the real agent and should end with the TSLA pool's reserves rising
  (cover paid out on the -3.5% reopen).
- Optional: put `ANTHROPIC_API_KEY=...` in `.env` and `npx pm2 restart agent` to turn on the news analyst.

If the VPS was down at the close, nothing is lost: when the agent comes back it opens the
markets for the current closure on its next tick. If the relayer missed rounds, it replays every mainnet
round it missed, in order.

## Demo on a weekday (`/demo`)

A live market exists only from Friday 20:00 ET to Sunday 20:00 ET. Any other time, open
https://vps.tail865d46.ts.net/demo (or "Try a demo weekend" on the landing page). It is the same dashboard on a
private copy of the testnet with its clock on Saturday; the agent has opened both markets and keeps trading, and
you trade as a funded demo wallet with no wallet extension.

1. Market: the header says "Gap-implied price"; buy a range (for example 5 shares of "-1% to -0.25%").
2. Borrow: the amber weekend banner; deposit 1 TSLA, borrow 5 USDG, buy 25% cover.
3. Back on Market, in the demo panel, set the reopening moves (defaults TSLA -3.5%, AMZN +0.8%) and press
   "Jump to the Sunday reopen". About 10 seconds later both markets show as settled, and the agent has collected
   the TSLA pool's cover.
4. Redeem the winning cover shares. "Start over" builds a fresh Saturday (about a minute). The demo is shared by
   everyone viewing it and resets itself 30 minutes after settling.

## What to record

Record the browser at http://localhost:4173 (landing page; the dashboard is `/app`), or the Tailscale URL of the machine sharing the web app (see
README "Running it"), with the explorer in a second tab.

**Saturday (market live), about 2 minutes**

0. Landing page (`/`): the weekend chart, then the live strip showing TSLA and AMZN "priced by the weekend market"
   with their ranges. Scroll to "One weekend, step by step": buy a range in step 2 and show the oracle band, the
   lender's numbers and the Sunday payout move with it; then the "What runs it" diagram. "Open the app".
1. Header pill reads "Gap-implied price". Price panel: implied TSLA price, the band, "reopens in" (counts down live;
   prices refresh in place every 12 s).
   Switch the header's stock picker to AMZN and back: each stock has its own market, oracle and pool.
2. Market card: the seven ranges with probabilities, "oracle source" badge. Point at the agent's trades in
   `logs/agent.log` next to the range bars moving.
3. Buy a range yourself (for example "-1% to -0.25%", 5 shares). Show the probability and the implied price move.
4. Market page: "Cost to move the price 1%" under the ranges, and underwriter fees accruing.
5. Borrow page: amber "Weekend pricing from the gap market" banner, borrow price below liquidation price.
   "Protect my loan": pick 25% of debt, show the premium, buy cover. Show "The pool's own cover this weekend".
6. Explorer: the GapMarket contract's recent transactions (market creation, the pool's hedge, trades) are all
   real testnet txs. Open one trade's call trace: GapMarket calls the LmsrMath Stylus program for its pricing.

**Monday morning IST (after the reopen), about 1 minute**

1. Header back to "Market open"; price panel shows the live feed price.
2. Market card, for TSLA and AMZN: "settled here" on the winning range, settle price, the reopening move. If a
   stock gapped down 3% or more, its pool's cover paid out; otherwise the premium was the cost of insurance.
3. Redeem any winning shares on camera.
4. Explorer: the settle transaction from the agent, and the MirroredFeed round it used, timestamped at
   Sunday 20:00 ET.

## Three-minute pitch

1. **Problem (30 s).** Tokenized stocks trade 24/7 on Robinhood Chain; their Chainlink feeds freeze for
   52 to 78 hours every weekend (show the README table). Chainlink's docs leave staleness to integrators.
   Every lender either stops or uses a stale price and eats the Monday gap.
2. **Product (45 s).** Gapline prices the closure: a USDG market on where the stock reopens, an oracle that
   turns it into a price and a confidence band behind the standard Chainlink interface, and a lending pool
   that borrows at the low end, liquidates only at the high end, and buys its own gap cover every weekend,
   paying the underwriter who funded the market.
3. **Live demo (75 s).** The Saturday and Monday clips above.
4. **Why it is sound (30 s).** The agent's forecast is backtested per stock on every weekend in each feed's
   history (Uniswap + BTC blend: 0.39 pp error vs 0.67 pp for the frozen feed on TSLA, 0.30 vs 0.60 on AMZN).
   The pricing math is a Rust Stylus program, bit-identical to PRBMath on 240 of 240 markets called on-chain.
   Settlement comes from the first post-reopen Chainlink round, checked against its predecessor; LMSR solvency
   fuzzed over 1,000 random trade sequences; a forked full-weekend test on the deployed contracts for both
   stocks; the agent trades inside hard caps. Mainnet needs one change: point at the real feeds.

## Submission text

**Name:** Gapline

**Tagline:** A market-implied weekend price for tokenized stocks, settled in USDG on Robinhood Chain.

**Description:**
Tokenized stocks trade 24/7, but their Chainlink feeds freeze from Friday afternoon to Sunday 20:00 ET, 52 to
78 hours a week on Robinhood's own TSLA feed. Lending protocols either stop or price collateral at a stale
number and absorb Monday's gap. Gapline opens a USDG-collateralized LMSR market on where each stock (TSLA and
AMZN) reopens for every closure, priced by an Arbitrum Stylus program in Rust that reproduces PRBMath bit for
bit, settles it permissionlessly from the first Chainlink round after the reopen, and turns its probabilities into a live price and confidence band behind the standard AggregatorV3Interface. Every
trade pays the market's underwriter. A demo lending pool shows the payoff: borrowing is valued at the band's
low end, liquidation requires the high end so thin weekend prints cannot liquidate anyone, and the pool buys
its own gap-down cover every weekend. An agent opens, prices, hedges, settles and collects each weekend's
markets inside hard spending limits, trading toward a Uniswap + BTC forecast fitted per stock and backtested on all
13 weekends in each feed's history (TSLA 0.39 pp error vs 0.67 pp for the frozen feed; AMZN 0.30 vs 0.60),
optionally with a Claude news analyst.

**Built with:** Solidity, Foundry, Arbitrum Stylus (Rust), OpenZeppelin, Chainlink, PRBMath, Robinhood Chain
testnet, Paxos USDG, viem, wagmi, TanStack, shadcn/ui, Anthropic Claude.

**Links:** repository, the explorer links in the README, and the demo video.
