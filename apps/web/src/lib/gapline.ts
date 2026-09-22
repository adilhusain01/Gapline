import {
	deployment,
	gapGuardedLendingPoolAbi,
	gapGuardedLendingPoolAddress,
	gapMarketAbi,
	gapMarketAddress,
	impliedPriceOracleAbi,
	impliedPriceOracleAddress,
	marketCalendarAbi,
	marketCalendarAddress,
	mirroredFeedAbi,
	mirroredFeedAddress,
	robinhoodTestnet,
} from "@gapline/abi";
import { useMemo } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

const chainId = robinhoodTestnet.id;
export const addresses = {
	calendar: marketCalendarAddress[chainId],
	feed: mirroredFeedAddress[chainId],
	gapMarket: gapMarketAddress[chainId],
	oracle: impliedPriceOracleAddress[chainId],
	pool: gapGuardedLendingPoolAddress[chainId],
	usdg: deployment.usdg as `0x${string}`,
	stock: deployment.stock as `0x${string}`,
} as const;

const calendar = {
	address: addresses.calendar,
	abi: marketCalendarAbi,
	chainId,
} as const;
const oracle = {
	address: addresses.oracle,
	abi: impliedPriceOracleAbi,
	chainId,
} as const;
const feed = {
	address: addresses.feed,
	abi: mirroredFeedAbi,
	chainId,
} as const;
const market = {
	address: addresses.gapMarket,
	abi: gapMarketAbi,
	chainId,
} as const;
const pool = {
	address: addresses.pool,
	abi: gapGuardedLendingPoolAbi,
	chainId,
} as const;

export type PriceBand = {
	low: bigint;
	mid: bigint;
	high: bigint;
	implied: boolean;
};

/** Session state, live feed round and the price the oracle is publishing right now. */
export function useSessionStatus() {
	const now = BigInt(Math.floor(Date.now() / 1000));
	const query = useReadContracts({
		contracts: [
			{ ...calendar, functionName: "isOpen", args: [now] },
			{ ...calendar, functionName: "nextOpen", args: [now] },
			{ ...calendar, functionName: "lastClose", args: [now] },
			{ ...oracle, functionName: "isFeedFrozen" },
			{ ...oracle, functionName: "priceBand" },
			{ ...feed, functionName: "latestRoundData" },
			{ ...oracle, functionName: "activeMarketId" },
			{ ...oracle, functionName: "hasActiveMarket" },
		],
	});

	const [
		isOpen,
		nextOpen,
		lastClose,
		frozen,
		band,
		round,
		activeMarketId,
		hasActiveMarket,
	] = query.data ?? [];

	return {
		...query,
		isOpen: isOpen?.result as boolean | undefined,
		nextOpen: nextOpen?.result as bigint | undefined,
		lastClose: lastClose?.result as bigint | undefined,
		isFeedFrozen: frozen?.result as boolean | undefined,
		band: band?.result
			? ({
					low: (band.result as readonly bigint[])[0],
					mid: (band.result as readonly bigint[])[1],
					high: (band.result as readonly bigint[])[2],
					implied: (band.result as readonly unknown[])[3] as boolean,
				} satisfies PriceBand)
			: undefined,
		feedPrice: round?.result
			? (round.result as readonly bigint[])[1]
			: undefined,
		feedUpdatedAt: round?.result
			? (round.result as readonly bigint[])[3]
			: undefined,
		activeMarketId: hasActiveMarket?.result
			? (activeMarketId?.result as bigint)
			: undefined,
	};
}

export type MarketView = {
	id: bigint;
	refPrice: bigint;
	closeTs: bigint;
	reopenTs: bigint;
	resolved: boolean;
	winner: number;
	settlePrice: bigint;
	liquidity: bigint;
	edges: readonly bigint[];
	shares: readonly bigint[];
	collateralHeld: bigint;
	feesAccrued: bigint;
	tailWidthBps: bigint;
	creator: `0x${string}`;
	prices: readonly bigint[];
	meanBps: bigint;
	stdevBps: bigint;
};

/** Every market, newest first, with live LMSR prices. */
export function useMarkets() {
	const count = useReadContract({ ...market, functionName: "marketCount" });
	const ids = useMemo(() => {
		const total = Number(count.data ?? 0n);
		return Array.from({ length: total }, (_, i) => BigInt(total - 1 - i));
	}, [count.data]);

	const details = useReadContracts({
		contracts: ids.flatMap((id) => [
			{ ...market, functionName: "getMarket", args: [id] },
			{ ...market, functionName: "prices", args: [id] },
			{ ...market, functionName: "impliedMove", args: [id] },
		]),
		query: { enabled: ids.length > 0 },
	});

	const markets: MarketView[] = useMemo(() => {
		if (!details.data) return [];
		return ids
			.map((id, index) => {
				const raw = details.data[index * 3]?.result as
					| Record<string, unknown>
					| undefined;
				const prices = details.data[index * 3 + 1]?.result as
					| readonly bigint[]
					| undefined;
				const move = details.data[index * 3 + 2]?.result as
					| readonly bigint[]
					| undefined;
				if (!raw || !prices || !move) return undefined;
				return {
					id,
					refPrice: raw.refPrice as bigint,
					closeTs: raw.closeTs as bigint,
					reopenTs: raw.reopenTs as bigint,
					resolved: raw.resolved as boolean,
					winner: Number(raw.winner),
					settlePrice: raw.settlePrice as bigint,
					liquidity: raw.liquidity as bigint,
					edges: raw.boundariesBps as readonly bigint[],
					shares: raw.shares as readonly bigint[],
					collateralHeld: raw.collateralHeld as bigint,
					feesAccrued: raw.feesAccrued as bigint,
					tailWidthBps: raw.tailWidthBps as bigint,
					creator: raw.creator as `0x${string}`,
					prices,
					meanBps: move[0],
					stdevBps: move[1],
				} satisfies MarketView;
			})
			.filter((m): m is MarketView => Boolean(m));
	}, [details.data, ids]);

	return {
		markets,
		isLoading: count.isLoading || details.isLoading,
		refetch: details.refetch,
	};
}

/** Balances and allowances for the connected wallet. */
export function useWalletState() {
	const { address } = useAccount();
	const query = useReadContracts({
		contracts: [
			{
				address: addresses.usdg,
				abi: erc20Abi,
				chainId,
				functionName: "balanceOf",
				args: [address ?? "0x0"],
			},
			{
				address: addresses.usdg,
				abi: erc20Abi,
				chainId,
				functionName: "allowance",
				args: [address ?? "0x0", addresses.gapMarket],
			},
			{
				address: addresses.usdg,
				abi: erc20Abi,
				chainId,
				functionName: "allowance",
				args: [address ?? "0x0", addresses.pool],
			},
			{
				address: addresses.stock,
				abi: erc20Abi,
				chainId,
				functionName: "balanceOf",
				args: [address ?? "0x0"],
			},
			{
				address: addresses.stock,
				abi: erc20Abi,
				chainId,
				functionName: "allowance",
				args: [address ?? "0x0", addresses.pool],
			},
		],
		query: { enabled: Boolean(address) },
	});
	const [
		usdgBalance,
		marketAllowance,
		poolAllowance,
		stockBalance,
		stockAllowance,
	] = query.data ?? [];
	return {
		...query,
		usdgBalance: usdgBalance?.result as bigint | undefined,
		marketAllowance: (marketAllowance?.result as bigint | undefined) ?? 0n,
		poolAllowance: (poolAllowance?.result as bigint | undefined) ?? 0n,
		stockBalance: stockBalance?.result as bigint | undefined,
		stockAllowance: (stockAllowance?.result as bigint | undefined) ?? 0n,
	};
}

/** The connected wallet's position in the demo lending pool. */
export function usePosition() {
	const { address } = useAccount();
	const query = useReadContracts({
		contracts: [
			{ ...pool, functionName: "collateralOf", args: [address ?? "0x0"] },
			{ ...pool, functionName: "debtOf", args: [address ?? "0x0"] },
			{ ...pool, functionName: "maxBorrow", args: [address ?? "0x0"] },
			{ ...pool, functionName: "isLiquidatable", args: [address ?? "0x0"] },
			{ ...pool, functionName: "riskPrice" },
			{ ...pool, functionName: "liquidationPrice" },
		],
		query: { enabled: Boolean(address) },
	});
	const [
		collateral,
		debt,
		maxBorrow,
		liquidatable,
		riskPrice,
		liquidationPrice,
	] = query.data ?? [];
	return {
		...query,
		collateral: collateral?.result as bigint | undefined,
		debt: debt?.result as bigint | undefined,
		maxBorrow: maxBorrow?.result as bigint | undefined,
		isLiquidatable: liquidatable?.result as boolean | undefined,
		riskPrice: riskPrice?.result as bigint | undefined,
		liquidationPrice: liquidationPrice?.result as bigint | undefined,
		/** riskPrice reverts while pricing is paused; surface that instead of a number. */
		pricingPaused: riskPrice?.status === "failure",
	};
}

/** The lending pool's own gap cover on a market, and its total outstanding debt. */
export function usePoolHedge(marketId: bigint | undefined) {
	const query = useReadContracts({
		contracts: [
			{ ...pool, functionName: "totalDebt" },
			{ ...pool, functionName: "hedgeShares", args: [marketId ?? 0n] },
			{ ...pool, functionName: "hedgePremium", args: [marketId ?? 0n] },
		],
		query: { enabled: marketId !== undefined },
	});
	const [totalDebt, shares, premium] = query.data ?? [];
	return {
		totalDebt: totalDebt?.result as bigint | undefined,
		shares: (shares?.result as bigint | undefined) ?? 0n,
		premium: (premium?.result as bigint | undefined) ?? 0n,
	};
}

export function useShareBalances(
	marketId: bigint | undefined,
	outcomes: number,
) {
	const { address } = useAccount();
	const query = useReadContracts({
		contracts: Array.from({ length: outcomes }, (_, i) => ({
			...market,
			functionName: "balanceOf" as const,
			args: [address ?? "0x0", ((marketId ?? 0n) << 8n) | BigInt(i)],
		})),
		query: {
			enabled: Boolean(address) && marketId !== undefined && outcomes > 0,
		},
	});
	return (query.data?.map(
		(entry) => (entry.result as bigint | undefined) ?? 0n,
	) ?? []) as bigint[];
}

/**
 * The round a market settles against: the first one published at or after the reopen.
 * Walks back from the latest round, which on a mirrored feed is a handful of entries.
 */
export function useSettlementRound(market: MarketView | undefined) {
	const latest = useReadContract({
		...feed,
		functionName: "latestRound",
		query: { enabled: Boolean(market) && !market?.resolved },
	});

	const lookback = 60n;
	const latestRound = (latest.data as bigint | undefined) ?? 0n;
	const first = latestRound > lookback ? latestRound - lookback : 1n;
	const candidates = useMemo(() => {
		const list: bigint[] = [];
		for (let round = first; round <= latestRound; round++) list.push(round);
		return list;
	}, [first, latestRound]);

	const rounds = useReadContracts({
		contracts: candidates.map((round) => ({
			...feed,
			functionName: "getRoundData" as const,
			args: [round],
		})),
		query: { enabled: candidates.length > 0 && Boolean(market) },
	});

	return useMemo(() => {
		if (!market || !rounds.data) return undefined;
		for (let i = 0; i < candidates.length; i++) {
			const result = rounds.data[i]?.result as readonly bigint[] | undefined;
			if (!result) continue;
			if (result[3] >= market.reopenTs) return candidates[i];
		}
		return undefined;
	}, [market, rounds.data, candidates]);
}

export {
	gapMarketAbi,
	gapGuardedLendingPoolAbi,
	impliedPriceOracleAbi,
	chainId,
};
