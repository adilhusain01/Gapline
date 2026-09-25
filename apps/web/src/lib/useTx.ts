import { robinhoodTestnet } from "@gapline/abi";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { type Abi, BaseError } from "viem";
import { useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { isDemo } from "@/lib/wagmi";

type Call = {
	address: `0x${string}`;
	abi: Abi;
	functionName: string;
	args?: readonly unknown[];
};

/** Sends a write, waits for the receipt, toasts the outcome and refreshes every read. */
export function useTx() {
	const { writeContractAsync } = useWriteContract();
	const config = useConfig();
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<string | null>(null);

	async function send(label: string, call: Call) {
		setPending(label);
		const toastId = toast.loading(`${label}...`);
		try {
			const hash = await writeContractAsync(call as never);
			await waitForTransactionReceipt(config, { hash });
			await queryClient.invalidateQueries();
			toast.success(label, {
				id: toastId,
				// Demo transactions live on a private fork, not on the public explorer.
				action: isDemo
					? undefined
					: {
							label: "View",
							onClick: () =>
								window.open(
									`${robinhoodTestnet.blockExplorers.default.url}/tx/${hash}`,
									"_blank",
								),
						},
			});
			return hash;
		} catch (error) {
			const message =
				error instanceof BaseError
					? (error.shortMessage ?? error.message)
					: error instanceof Error
						? error.message
						: "Transaction failed";
			toast.error(label, { id: toastId, description: message.slice(0, 160) });
			return undefined;
		} finally {
			setPending(null);
		}
	}

	return { send, pending };
}
