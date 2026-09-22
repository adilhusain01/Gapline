import { defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";
import deployment from "../../contracts/deployments/46630.json" with { type: "json" };

const chainId = 46630;

export default defineConfig({
  out: "src/generated.ts",
  plugins: [
    foundry({
      project: "../../contracts",
      forge: { build: true },
      include: [
        "MarketCalendar.sol/**",
        "MirroredFeed.sol/**",
        "GapMarket.sol/**",
        "ImpliedPriceOracle.sol/**",
        "GapGuardedLendingPool.sol/**",
        "IERC20Metadata.sol/**",
        "AggregatorV3Interface.sol/**",
      ],
      deployments: {
        MarketCalendar: { [chainId]: deployment.calendar as `0x${string}` },
        MirroredFeed: { [chainId]: deployment.feed as `0x${string}` },
        GapMarket: { [chainId]: deployment.gapMarket as `0x${string}` },
        ImpliedPriceOracle: { [chainId]: deployment.oracle as `0x${string}` },
        GapGuardedLendingPool: { [chainId]: deployment.lendingPool as `0x${string}` },
      },
    }),
  ],
});
