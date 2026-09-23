import {
  type StockSymbol,
  aggregatorV3InterfaceAbi,
  deployment,
  gapGuardedLendingPoolAbi,
  gapMarketAbi,
  gapMarketAddress,
  impliedPriceOracleAbi,
  marketCalendarAbi,
  marketCalendarAddress,
  mirroredFeedAbi,
  robinhood,
  robinhoodTestnet,
  stocks,
} from "@gapline/abi";
import { createPublicClient, createWalletClient, erc20Abi, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { config } from "./config";

const id = robinhoodTestnet.id;

export const account = privateKeyToAccount(config.privateKey);
/** TESTNET_RPC_URL points the agent at a fork (e.g. anvil) for weekend rehearsals; unset means the public RPC. */
const testnetRpc = process.env.TESTNET_RPC_URL || undefined;
export const testnet = createPublicClient({ chain: robinhoodTestnet, transport: http(testnetRpc) });
export const mainnet = createPublicClient({ chain: robinhood, transport: http() });
export const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport: http(testnetRpc) });

/** Contracts shared by every stock. */
export const contracts = {
  calendar: { address: marketCalendarAddress[id], abi: marketCalendarAbi },
  market: { address: gapMarketAddress[id], abi: gapMarketAbi },
  usdg: { address: deployment.usdg, abi: erc20Abi },
} as const;

/** One stock's testnet feed, oracle and lending pool. */
export function stockContracts(symbol: StockSymbol) {
  const d = stocks[symbol].testnet;
  return {
    feed: { address: d.feed, abi: mirroredFeedAbi },
    oracle: { address: d.oracle, abi: impliedPriceOracleAbi },
    pool: { address: d.lendingPool, abi: gapGuardedLendingPoolAbi },
  } as const;
}

/** Chainlink WBTC / USD on Robinhood Chain mainnet: crypto keeps trading while stocks are closed. */
export const MAINNET_BTC_FEED = { address: "0x62107b0d3adA75fc1697fD342d99eed947a3aA5E", abi: aggregatorV3InterfaceAbi } as const;

/**
 * Chain time, not wall-clock time: session and settlement checks on-chain use block.timestamp, so the agent
 * follows the chain's clock. syncClock() runs at the start of every tick.
 */
let clockOffset = 0;
export async function syncClock() {
  const block = await testnet.getBlock();
  clockOffset = Number(block.timestamp) - Math.floor(Date.now() / 1000);
}
export const now = () => BigInt(Math.floor(Date.now() / 1000) + clockOffset);

export const log = (scope: string, message: string) =>
  console.log(`${new Date().toISOString()}  [${scope}] ${message}`);
