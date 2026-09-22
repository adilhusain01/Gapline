import { BaseError, maxUint256 } from "viem";

import { account, contracts, log, testnet, wallet } from "./chain";
import { config } from "./config";

type Write = Parameters<typeof testnet.simulateContract>[0];

/** Simulate first so reverts surface with a readable reason, then send and wait. */
export async function send(scope: string, label: string, call: Omit<Write, "account">) {
  if (config.dryRun) {
    log(scope, `[dry-run] ${label}`);
    return undefined;
  }
  try {
    const { request } = await testnet.simulateContract({ ...call, account } as Write);
    const hash = await wallet.writeContract(request);
    const receipt = await testnet.waitForTransactionReceipt({ hash });
    log(scope, `${label}  ${receipt.status}  tx ${hash}`);
    return receipt.status === "success" ? hash : undefined;
  } catch (error) {
    const reason = error instanceof BaseError ? error.shortMessage : String(error);
    log(scope, `${label} failed: ${reason}`);
    return undefined;
  }
}

/** Lets GapMarket pull USDG for seeding and buying. */
export async function ensureAllowance(minimum: bigint) {
  const allowance = await testnet.readContract({
    ...contracts.usdg,
    functionName: "allowance",
    args: [account.address, contracts.market.address],
  });
  if (allowance >= minimum) return true;
  return Boolean(
    await send("keeper", "approve USDG for GapMarket", {
      ...contracts.usdg,
      functionName: "approve",
      args: [contracts.market.address, maxUint256],
    }),
  );
}
