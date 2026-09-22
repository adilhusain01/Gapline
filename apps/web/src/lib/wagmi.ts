import { robinhoodTestnet } from "@gapline/abi";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  connectors: [injected()],
  transports: { [robinhoodTestnet.id]: http() },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
