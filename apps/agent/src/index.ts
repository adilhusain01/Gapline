import { formatUnits } from "viem";

import { STOCK_SYMBOLS } from "@gapline/abi";

import { account, contracts, log, syncClock, testnet } from "./chain";
import { config } from "./config";
import { keeperTick } from "./keeper";
import { traderTick } from "./trader";

async function tick() {
  try {
    await syncClock();
  } catch (error) {
    log("agent", `clock sync failed, using local time: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  try {
    await keeperTick();
  } catch (error) {
    log("keeper", `tick failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  try {
    await traderTick();
  } catch (error) {
    log("trader", `tick failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

const balance = await testnet.readContract({ ...contracts.usdg, functionName: "balanceOf", args: [account.address] });
log(
  "agent",
  `${account.address} with ${formatUnits(balance, 6)} USDG; stocks ${STOCK_SYMBOLS.join(", ")}; depth ${config.depth}, max ${config.maxSpendPerTradeUsdg} USDG/trade, ` +
    `${config.maxExposureUsdg} USDG/market${config.dryRun ? ", dry run" : ""}; analyst ${process.env.ANTHROPIC_API_KEY ? "on" : "off"}`,
);

if (process.argv.includes("--once")) {
  await tick();
} else {
  for (;;) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, config.tickMs));
  }
}
