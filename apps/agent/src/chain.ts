import {
  aggregatorV3InterfaceAbi,
  deployment,
  gapGuardedLendingPoolAbi,
  gapGuardedLendingPoolAddress,
  gapMarketAbi,
  gapMarketAddress,
  impliedPriceOracleAbi,
  impliedPriceOracleAddress,
  marketCalendarAbi,
  marketCalendarAddress,
  mirroredFeedAbi,
  mirroredFeedAddress,
  robinhood,
  robinhoodTestnet,
} from "@gapline/abi";
import { createPublicClient, createWalletClient, erc20Abi, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { config } from "./config";

const id = robinhoodTestnet.id;

export const account = privateKeyToAccount(config.privateKey);
export const testnet = createPublicClient({ chain: robinhoodTestnet, transport: http() });
export const mainnet = createPublicClient({ chain: robinhood, transport: http() });
export const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport: http() });

export const contracts = {
  calendar: { address: marketCalendarAddress[id], abi: marketCalendarAbi },
  feed: { address: mirroredFeedAddress[id], abi: mirroredFeedAbi },
  market: { address: gapMarketAddress[id], abi: gapMarketAbi },
  oracle: { address: impliedPriceOracleAddress[id], abi: impliedPriceOracleAbi },
  pool: { address: gapGuardedLendingPoolAddress[id], abi: gapGuardedLendingPoolAbi },
  usdg: { address: deployment.usdg as `0x${string}`, abi: erc20Abi },
} as const;

/** Chainlink WBTC / USD on Robinhood Chain mainnet: crypto keeps trading while stocks are closed. */
export const MAINNET_BTC_FEED = { address: "0x62107b0d3adA75fc1697fD342d99eed947a3aA5E", abi: aggregatorV3InterfaceAbi } as const;

export const now = () => BigInt(Math.floor(Date.now() / 1000));

export const log = (scope: string, message: string) =>
  console.log(`${new Date().toISOString()}  [${scope}] ${message}`);
