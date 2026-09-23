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
        "ILmsrMath.sol/**",
        "ImpliedPriceOracle.sol/**",
        "GapGuardedLendingPool.sol/**",
        "IERC20Metadata.sol/**",
        "AggregatorV3Interface.sol/**",
      ],
      // Singletons only; per-stock contracts (feed, oracle, pool) come from `stocks` in src/index.ts.
      deployments: {
        MarketCalendar: { [chainId]: deployment.calendar as `0x${string}` },
        GapMarket: { [chainId]: deployment.gapMarket as `0x${string}` },
        ILmsrMath: { [chainId]: deployment.lmsrMath as `0x${string}` },
      },
    }),
  ],
});
