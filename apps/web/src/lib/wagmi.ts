import { robinhoodTestnet } from "@gapline/abi";
import { createConfig, createStorage, http } from "wagmi";
import { injected, mock } from "wagmi/connectors";

/**
 * /demo pages talk to the demo controller (apps/demo): a private fork held on a Saturday, reached through
 * /demo-api. Everything else talks to Robinhood Chain testnet. Chosen once per page load, so moving between the
 * two is always a full page load.
 */
export const isDemo = window.location.pathname.startsWith("/demo");
export const DEMO_API = `${window.location.origin}/demo-api`;
/** The shared demo wallet (apps/demo): an address no one holds a key for, impersonated and funded on the fork. */
export const DEMO_WALLET = "0xb6E922A053A6FFAf3978048857Db69170196A9dB";

const demoRpc = `${DEMO_API}/rpc`;
// The mock connector sends transactions to the chain's own RPC URL, so the demo chain points there.
const chain = isDemo
	? { ...robinhoodTestnet, rpcUrls: { default: { http: [demoRpc] } } }
	: robinhoodTestnet;

export const wagmiConfig = createConfig({
	chains: [chain],
	connectors: isDemo
		? [
				mock({
					accounts: [DEMO_WALLET],
					features: { defaultConnected: true, reconnect: true },
				}),
			]
		: [injected()],
	storage: createStorage({
		storage: window.localStorage,
		key: isDemo ? "wagmi-demo" : "wagmi",
	}),
	transports: {
		// VITE_TESTNET_RPC_URL points the app at a fork for weekend rehearsals; unset means the public RPC.
		[chain.id]: http(
			isDemo ? demoRpc : import.meta.env.VITE_TESTNET_RPC_URL || undefined,
		),
	},
});

declare module "wagmi" {
	interface Register {
		config: typeof wagmiConfig;
	}
}
