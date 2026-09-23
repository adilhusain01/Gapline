import type { Address } from "viem";

import deploymentJson from "../../../contracts/deployments/46630.json" with { type: "json" };

export * from "./generated";
export { robinhood, robinhoodTestnet } from "viem/chains";

/** Per-stock testnet contracts written by contracts/script/Deploy.s.sol. */
export type StockDeployment = { token: Address; feed: Address; oracle: Address; lendingPool: Address; mainnetFeed: Address };

export const deployment = deploymentJson as Omit<typeof deploymentJson, "stocks"> & {
  usdg: Address;
  calendar: Address;
  gapMarket: Address;
  lmsrMath: Address;
  stocks: Record<StockSymbol, StockDeployment>;
};

/** Paxos USDG on Robinhood Chain mainnet. */
export const MAINNET_USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;

/**
 * Robinhood Chain mainnet data behind each stock: the Chainlink feed the relayer mirrors, the stock token, and the
 * deepest Uniswap v3 pool against USDG (token0 = stock, 18 decimals; token1 = USDG, 6 decimals), which keeps
 * trading while the feed is frozen. Pools found via the DexScreener API on 2026-09-23.
 */
export const MAINNET_STOCKS = {
  TSLA: {
    name: "Tesla",
    feed: "0x4A1166a659A55625345e9515b32adECea5547C38",
    token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
    usdgPool: "0xf4ACdAEEB7022862A763C9B1B885e11191c889E3",
  },
  AMZN: {
    name: "Amazon",
    feed: "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C",
    token: "0x12f190a9F9d7D37a250758b26824B97CE941bF54",
    usdgPool: "0x8AC92DA74AB5F3b1d024Dc1943Ad7e15Dc4179Ef",
  },
} as const satisfies Record<string, { name: string; feed: Address; token: Address; usdgPool: Address }>;

export type StockSymbol = keyof typeof MAINNET_STOCKS;
export const STOCK_SYMBOLS = Object.keys(MAINNET_STOCKS) as StockSymbol[];

/** Everything known about one stock: mainnet sources plus its testnet deployment. */
export const stocks = Object.fromEntries(
  STOCK_SYMBOLS.map((symbol) => [
    symbol,
    { symbol, ...MAINNET_STOCKS[symbol], testnet: deployment.stocks[symbol] },
  ]),
) as {
  [S in StockSymbol]: { symbol: S; testnet: StockDeployment } & (typeof MAINNET_STOCKS)[S];
};

/** The stock whose testnet MirroredFeed is `feed`, if any. */
export function stockByFeed(feed: Address) {
  return STOCK_SYMBOLS.map((s) => stocks[s]).find((s) => s.testnet.feed.toLowerCase() === feed.toLowerCase());
}
