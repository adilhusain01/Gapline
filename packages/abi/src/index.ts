export * from "./generated";
export { robinhood, robinhoodTestnet } from "viem/chains";
export { default as deployment } from "../../../contracts/deployments/46630.json" with { type: "json" };

/** Chainlink RHTSLA / USD on Robinhood Chain mainnet (reference-data-directory feeds-robinhood-mainnet). */
export const MAINNET_TSLA_FEED = "0x4A1166a659A55625345e9515b32adECea5547C38" as const;
