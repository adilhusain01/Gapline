import { createPublicClient, createWalletClient, http, formatUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  STOCK_SYMBOLS,
  type StockSymbol,
  aggregatorV3InterfaceAbi,
  mirroredFeedAbi,
  robinhood,
  robinhoodTestnet,
  stocks,
} from "@gapline/abi";

const POLL_MS = Number(process.env.RELAYER_POLL_MS ?? 15_000);
/** Never replay more than this many mainnet rounds in one catch-up. */
const MAX_CATCH_UP = 50n;
const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

const mainnet = createPublicClient({ chain: robinhood, transport: http() });
const testnet = createPublicClient({ chain: robinhoodTestnet, transport: http() });
const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport: http() });

const log = (message: string) => console.log(`${new Date().toISOString()}  ${message}`);

type Round = { roundId: bigint; answer: bigint; startedAt: bigint; updatedAt: bigint };

async function mainnetRound(symbol: StockSymbol, roundId?: bigint): Promise<Round> {
  const source = stocks[symbol].feed;
  const [id, answer, startedAt, updatedAt] =
    roundId === undefined
      ? await mainnet.readContract({ address: source, abi: aggregatorV3InterfaceAbi, functionName: "latestRoundData" })
      : await mainnet.readContract({
          address: source,
          abi: aggregatorV3InterfaceAbi,
          functionName: "getRoundData",
          args: [roundId],
        });
  return { roundId: id, answer, startedAt, updatedAt };
}

async function mirroredUpdatedAt(mirror: `0x${string}`): Promise<bigint> {
  const latestRound = await testnet.readContract({ address: mirror, abi: mirroredFeedAbi, functionName: "latestRound" });
  if (latestRound === 0n) return 0n;
  const [, , , updatedAt] = await testnet.readContract({ address: mirror, abi: mirroredFeedAbi, functionName: "latestRoundData" });
  return updatedAt;
}

/**
 * Every mainnet round of `symbol` newer than the last mirrored one, oldest first. Walking back round by round
 * keeps the testnet feed a faithful copy, so the first round after a reopen is the true reopening print.
 */
async function pendingRounds(symbol: StockSymbol, lastMirrored: bigint): Promise<Round[]> {
  const latest = await mainnetRound(symbol);
  if (latest.updatedAt <= lastMirrored) return [];
  if (lastMirrored === 0n) return [latest];

  const pending = [latest];
  for (let id = latest.roundId - 1n; latest.roundId - id < MAX_CATCH_UP; id--) {
    const round = await mainnetRound(symbol, id).catch(() => undefined);
    if (!round || round.updatedAt <= lastMirrored) break;
    pending.unshift(round);
  }
  return pending;
}

/** One stock at a time: every mirror is sent from the same account, so transactions stay in nonce order. */
async function tick(symbol: StockSymbol) {
  const mirror = stocks[symbol].testnet.feed;
  const rounds = await pendingRounds(symbol, await mirroredUpdatedAt(mirror));
  for (const round of rounds) {
    const hash = await wallet.writeContract({
      address: mirror,
      abi: mirroredFeedAbi,
      functionName: "mirror",
      args: [round.answer, round.startedAt, round.updatedAt],
    });
    await testnet.waitForTransactionReceipt({ hash });
    const age = Math.round(Date.now() / 1000 - Number(round.updatedAt));
    log(`mirrored ${symbol} $${formatUnits(round.answer, 8)} (mainnet round ${age}s old)  tx ${hash}`);
  }
}

log(
  `relayer ${account.address} -> ${STOCK_SYMBOLS.map((s) => `${s} ${stocks[s].testnet.feed}`).join(", ")}, polling every ${POLL_MS / 1000}s`,
);
for (;;) {
  for (const symbol of STOCK_SYMBOLS) {
    try {
      await tick(symbol);
    } catch (error) {
      log(`${symbol} tick failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
