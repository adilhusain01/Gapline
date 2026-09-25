/**
 * Weekend demo on demand. Runs a private anvil fork of Robinhood Chain testnet held on the Saturday of the next
 * closure, with a live market per stock opened by the real agent, and serves it to the web app's /demo pages:
 *
 *   POST /rpc     JSON-RPC to the fork: reads, plus transactions from the shared demo wallet only
 *   GET  /state   phase, closure times, reference prices, recent agent log
 *   POST /reopen  jump to the Sunday 20:00 ET reopen with the chosen moves, then let the agent settle
 *   POST /reset   a fresh fork, staged back to Saturday
 *
 * Nothing here touches the real testnet: every write goes to the fork, which is thrown away on reset.
 * Staging follows scripts/rehearse-weekend.sh. Anvil cannot execute Stylus WASM, so the bit-identical Solidity
 * LmsrMathSol is etched over the Stylus address first.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  aggregatorV3InterfaceAbi,
  deployment,
  gapGuardedLendingPoolAbi,
  marketCalendarAbi,
  marketCalendarAddress,
  mirroredFeedAbi,
  robinhood,
  robinhoodTestnet,
  STOCK_SYMBOLS,
  type StockSymbol,
  stocks,
} from "@gapline/abi";
import {
  type Address,
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeAbiParameters,
  erc20Abi,
  type Hex,
  http,
  keccak256,
  numberToHex,
  pad,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = new URL("../../../", import.meta.url);
const PORT = Number(process.env.DEMO_PORT ?? 4180);
const FORK_PORT = Number(process.env.DEMO_FORK_PORT ?? 8548);
const FORK = `http://127.0.0.1:${FORK_PORT}`;
const UPSTREAM = process.env.DEMO_FORK_URL ?? "https://rpc.testnet.chain.robinhood.com";
/**
 * The shared demo wallet: the last 20 bytes of keccak256("gapline demo wallet"), so no one holds its key. The fork
 * impersonates it. Anvil's own dev accounts have public keys, and on real chains sweeper bots attach EIP-7702
 * delegations to them, which makes GapMarket refuse to send them ERC-1155 shares.
 */
const DEMO_WALLET: Address = "0xb6E922A053A6FFAf3978048857Db69170196A9dB";
/** The agent keeps trading on Saturday so visitors' trades get a response. */
const AGENT_EVERY_MS = 90_000;
/** A settled demo, or one whose clock nears the reopen on its own, starts over. */
const SETTLED_TTL_MS = 30 * 60_000;

const deployer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
const chain = { ...robinhoodTestnet, rpcUrls: { default: { http: [FORK] } } };
const fork = createPublicClient({ chain, transport: http(FORK) });
const anvil = createTestClient({ chain, mode: "anvil", transport: http(FORK) });
const wallet = createWalletClient({ account: deployer, chain, transport: http(FORK) });
const mainnet = createPublicClient({ chain: robinhood, transport: http() });
const calendar = { address: marketCalendarAddress[robinhoodTestnet.id], abi: marketCalendarAbi } as const;

const lmsrMathSol = JSON.parse(
  readFileSync(new URL("contracts/out/LmsrMathSol.sol/LmsrMathSol.json", ROOT), "utf8"),
).deployedBytecode.object as Hex;

type Phase = "starting" | "saturday" | "reopening" | "settled" | "error";
const state = {
  phase: "starting" as Phase,
  close: 0n,
  reopen: 0n,
  refs: {} as Partial<Record<StockSymbol, bigint>>,
  moves: {} as Partial<Record<StockSymbol, number>>,
  log: [] as string[],
  error: "",
  since: Date.now(),
  lastReset: 0,
  /** Fork time minus wall-clock time, in seconds; anvil keeps it constant between jumps. */
  clockOffset: 0,
};
let busy = false;
let node: ChildProcess | undefined;

function log(line: string) {
  const stamped = `${new Date().toISOString().slice(11, 19)} ${line}`;
  console.log(stamped);
  state.log = [...state.log, stamped].slice(-40);
}

function setPhase(phase: Phase) {
  state.phase = phase;
  state.since = Date.now();
}

async function startAnvil() {
  node?.kill();
  node = spawn("anvil", ["--fork-url", UPSTREAM, "--chain-id", String(robinhoodTestnet.id), "--port", String(FORK_PORT), "--silent"], {
    stdio: "ignore",
  });
  for (let i = 0; i < 150; i++) {
    try {
      await fork.getChainId();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error("anvil did not start");
}

async function send(request: Parameters<typeof wallet.writeContract>[0]) {
  const hash = await wallet.writeContract(request);
  const receipt = await fork.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`reverted: ${request.functionName}`);
}

/**
 * Sets an ERC-20 balance by finding the balances mapping in storage, the way forge-std's deal() does: try the
 * common slots and the OpenZeppelin v5 namespaced location, keep the one that moves balanceOf.
 */
async function deal(token: Address, holder: Address, amount: bigint) {
  const candidates = [
    ...Array.from({ length: 12 }, (_, i) => BigInt(i)),
    0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00n,
  ];
  for (const slot of candidates) {
    const key = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [holder, slot]));
    const before = await fork.getStorageAt({ address: token, slot: key });
    await anvil.setStorageAt({ address: token, index: key, value: pad(numberToHex(amount)) });
    const balance = await fork.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [holder] });
    if (balance === amount) return;
    await anvil.setStorageAt({ address: token, index: key, value: before ?? pad("0x0") });
  }
  throw new Error(`could not find the balance slot of ${token}`);
}

/** One agent cycle against the fork, logging its keeper and trader lines. */
function runAgent() {
  return new Promise<void>((resolve) => {
    const agent = spawn("npm", ["run", "once", "--silent", "-w", "@gapline/agent"], {
      cwd: ROOT,
      env: { ...process.env, TESTNET_RPC_URL: FORK },
    });
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (/\[(keeper|trader)\]/.test(line)) log(line.replace(/^\S+\s+/, ""));
    };
    agent.stdout.on("data", onData);
    agent.stderr.on("data", onData);
    agent.on("close", () => resolve());
  });
}

async function chainNow() {
  return (await fork.getBlock()).timestamp;
}

/** Call right after mining a block, so the latest block's timestamp is the fork's current time. */
async function syncOffset() {
  state.clockOffset = Number(await chainNow()) - Math.floor(Date.now() / 1000);
}

/** Stage the next closure's Friday, then jump to Saturday noon and let the agent open the markets. */
async function stage() {
  await anvil.setCode({ address: deployment.lmsrMath, bytecode: lmsrMathSol });

  let t = await chainNow();
  // During a real closure, stage the following one: the fork clock cannot move backwards.
  if (!(await fork.readContract({ ...calendar, functionName: "isOpen", args: [t] }))) {
    t = (await fork.readContract({ ...calendar, functionName: "nextOpen", args: [t] })) + 3600n;
  }
  while (await fork.readContract({ ...calendar, functionName: "isOpen", args: [t] })) t += 3600n;
  state.close = await fork.readContract({ ...calendar, functionName: "lastClose", args: [t] });
  state.reopen = await fork.readContract({ ...calendar, functionName: "nextOpen", args: [t] });
  state.moves = {};

  const last = state.close - 600n;
  await anvil.setNextBlockTimestamp({ timestamp: last });
  await anvil.impersonateAccount({ address: DEMO_WALLET });
  await anvil.setBalance({ address: DEMO_WALLET, value: parseUnits("100", 18) });
  await anvil.setCode({ address: DEMO_WALLET, bytecode: "0x" });
  await deal(deployment.usdg, deployer.address, parseUnits("500", 6));
  await deal(deployment.usdg, DEMO_WALLET, parseUnits("100", 6));
  for (const symbol of STOCK_SYMBOLS) {
    const s = stocks[symbol].testnet;
    const [, ref] = await mainnet.readContract({ address: stocks[symbol].feed, abi: aggregatorV3InterfaceAbi, functionName: "latestRoundData" });
    state.refs[symbol] = ref;
    await send({ address: s.feed, abi: mirroredFeedAbi, functionName: "mirror", args: [ref, last, last] });
    await deal(s.token, deployer.address, parseUnits("10", 18));
    await deal(s.token, DEMO_WALLET, parseUnits("5", 18));
    // A funded pool with one open loan, so the keeper has something to insure.
    await send({ address: deployment.usdg, abi: erc20Abi, functionName: "transfer", args: [s.lendingPool, parseUnits("10", 6)] });
    await send({ address: s.token, abi: erc20Abi, functionName: "approve", args: [s.lendingPool, parseUnits("1", 18)] });
    await send({ address: s.lendingPool, abi: gapGuardedLendingPoolAbi, functionName: "deposit", args: [parseUnits("1", 18)] });
    await send({ address: s.lendingPool, abi: gapGuardedLendingPoolAbi, functionName: "borrow", args: [parseUnits("5", 6)] });
    log(`${symbol}: Friday close ${Number(ref) / 1e8}`);
  }

  await anvil.setNextBlockTimestamp({ timestamp: state.close + 12n * 3600n });
  await anvil.mine({ blocks: 1 });
  await syncOffset();
  log("Saturday: agent opens the markets");
  await runAgent();
  setPhase("saturday");
}

async function reset() {
  busy = true;
  setPhase("starting");
  state.lastReset = Date.now();
  state.error = "";
  try {
    await startAnvil();
    log("fork started");
    await stage();
  } catch (error) {
    state.error = error instanceof Error ? error.message.split("\n")[0] : String(error);
    setPhase("error");
    log(`error: ${state.error}`);
  } finally {
    busy = false;
  }
}

/** Sunday 20:00 ET: post each stock's reopening price, then let the agent settle and collect. */
async function reopen(moves: Partial<Record<StockSymbol, number>>) {
  busy = true;
  setPhase("reopening");
  try {
    const at = state.reopen + 5n;
    await anvil.setNextBlockTimestamp({ timestamp: at });
    for (const symbol of STOCK_SYMBOLS) {
      const bps = Math.max(-1500, Math.min(1500, Math.round(moves[symbol] ?? 0)));
      state.moves[symbol] = bps;
      const ref = state.refs[symbol] ?? 0n;
      const price = (ref * BigInt(10_000 + bps)) / 10_000n;
      await send({ address: stocks[symbol].testnet.feed, abi: mirroredFeedAbi, functionName: "mirror", args: [price, at, at] });
      log(`${symbol}: reopens ${bps >= 0 ? "+" : ""}${(bps / 100).toFixed(2)}% at ${Number(price) / 1e8}`);
    }
    await anvil.setNextBlockTimestamp({ timestamp: state.reopen + 60n });
    await anvil.mine({ blocks: 1 });
    await syncOffset();
    log("Sunday 20:00 ET: agent settles");
    await runAgent();
    setPhase("settled");
  } catch (error) {
    state.error = error instanceof Error ? error.message.split("\n")[0] : String(error);
    setPhase("error");
    log(`error: ${state.error}`);
  } finally {
    busy = false;
  }
}

// Reads, plus the demo wallet's own transactions. Anvil's cheat methods (anvil_*, evm_*) stay private.
const READS = new Set([
  "eth_chainId",
  "net_version",
  "web3_clientVersion",
  "eth_blockNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getLogs",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionCount",
]);

type RpcCall = { id?: unknown; jsonrpc?: string; method?: string; params?: unknown[] };

async function forward(call: RpcCall) {
  const reject = (message: string) => ({ jsonrpc: "2.0", id: call.id ?? null, error: { code: -32601, message } });
  const method = call.method ?? "";
  if (method === "eth_accounts") return { jsonrpc: "2.0", id: call.id ?? null, result: [DEMO_WALLET] };
  if (method === "eth_sendTransaction") {
    const from = (call.params?.[0] as { from?: string } | undefined)?.from;
    if (from?.toLowerCase() !== DEMO_WALLET.toLowerCase()) return reject("only the demo wallet can send transactions");
  } else if (!READS.has(method)) {
    return reject(`${method} is not available on the demo`);
  }
  const response = await fetch(FORK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: call.id ?? 1, method, params: call.params ?? [] }),
  });
  return response.json();
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body, (_, value) => (typeof value === "bigint" ? value.toString() : value)));
}

createServer(async (req, res) => {
  // Served behind `tailscale funnel --set-path /demo-api`; accept the path with or without that prefix.
  const path = (req.url ?? "/").split("?")[0].replace(/^\/demo-api/, "") || "/";
  try {
    if (req.method === "POST" && path === "/rpc") {
      if (state.phase === "starting") return json(res, 503, { error: "the demo is starting" });
      const body = JSON.parse(await readBody(req)) as RpcCall | RpcCall[];
      return json(res, 200, Array.isArray(body) ? await Promise.all(body.map(forward)) : await forward(body));
    }
    if (req.method === "GET" && path === "/state") {
      return json(res, 200, {
        phase: state.phase,
        busy,
        close: state.close,
        reopen: state.reopen,
        refs: state.refs,
        moves: state.moves,
        wallet: DEMO_WALLET,
        clockOffset: state.clockOffset,
        error: state.error,
        log: state.log.slice(-12),
      });
    }
    if (req.method === "POST" && path === "/reopen") {
      if (busy || state.phase !== "saturday") return json(res, 409, { error: "the demo is not on Saturday" });
      const { moves } = JSON.parse((await readBody(req)) || "{}") as { moves?: Partial<Record<StockSymbol, number>> };
      void reopen(moves ?? {});
      return json(res, 202, { ok: true });
    }
    if (req.method === "POST" && path === "/reset") {
      const recent = Date.now() - state.lastReset < 60_000;
      if (busy || (recent && state.phase === "saturday")) return json(res, 409, { error: "the demo was just reset" });
      void reset();
      return json(res, 202, { ok: true });
    }
    json(res, 404, { error: "not found" });
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message.split("\n")[0] : "bad request" });
  }
}).listen(PORT, "127.0.0.1", () => log(`demo controller on http://127.0.0.1:${PORT}`));

// Keep the agent trading on Saturday; start over once a settled demo has been up a while or the clock nears Sunday.
setInterval(async () => {
  if (busy) return;
  if (state.phase === "settled" && Date.now() - state.since > SETTLED_TTL_MS) return void reset();
  if (state.phase !== "saturday") return;
  try {
    if ((await chainNow()) > state.reopen - 3600n) return void reset();
    busy = true;
    await runAgent();
  } finally {
    busy = false;
  }
}, AGENT_EVERY_MS);

process.on("SIGINT", () => {
  node?.kill();
  process.exit(0);
});
process.on("SIGTERM", () => {
  node?.kill();
  process.exit(0);
});

void reset();
