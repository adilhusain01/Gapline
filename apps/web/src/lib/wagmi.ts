import { robinhoodTestnet } from "@gapline/abi";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
	chains: [robinhoodTestnet],
	connectors: [injected()],
	transports: {
		// VITE_TESTNET_RPC_URL points the app at a fork for weekend rehearsals; unset means the public RPC.
		[robinhoodTestnet.id]: http(
			import.meta.env.VITE_TESTNET_RPC_URL || undefined,
		),
	},
});

declare module "wagmi" {
	interface Register {
		config: typeof wagmiConfig;
	}
}
