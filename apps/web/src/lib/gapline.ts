import {
	deployment,
	gapGuardedLendingPoolAbi,
	gapMarketAbi,
	gapMarketAddress,
	impliedPriceOracleAbi,
	marketCalendarAbi,
	marketCalendarAddress,
	mirroredFeedAbi,
	robinhoodTestnet,
	type StockSymbol,
	stocks,
} from "@gapline/abi";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import { useNow } from "@/lib/clock";
import { useUi } from "@/lib/store";

const chainId = robinhoodTestnet.id;
/** Contracts shared by every stock. */
export const addresses = {
	calendar: marketCalendarAddress[chainId],
	gapMarket: gapMarketAddress[chainId],
	lmsrMath: deployment.lmsrMath,
	usdg: deployment.usdg,
} as const;

const calendar = {
	address: addresses.calendar,
	abi: marketCalendarAbi,
	chainId,
} as const;
const market = {
	address: addresses.gapMarket,
	abi: gapMarketAbi,
	chainId,
} as const;

/**
 * Query options that keep showing a read's last result while its arguments move (a new time step, a new feed
 * round), so a refresh updates numbers in place instead of dropping back to a loading state. Never carries one
 * stock's numbers over to another.
 */
function keepWithinStock(symbol: StockSymbol) {
	return {
		meta: { stock: symbol },
		placeholderData: <T>(
			previous: T | undefined,
			query: { meta?: Record<string, unknown> } | undefined,
		) => (query?.meta?.stock === symbol ? previous : undefined),
	};
}

/** The stock picked in the header, with its testnet feed, oracle, lending pool and token. */
export function useStock() {
	const symbol = useUi((state) => state.stock);
	return useMemo(() => {
		const stock = stocks[symbol];
		const d = stock.testnet;
		return {
			symbol,
			name: stock.name,
			token: d.token,
			feed: { address: d.feed, abi: mirroredFeedAbi, chainId } as const,
			oracle: {
				address: d.oracle,
				abi: impliedPriceOracleAbi,
				chainId,
			} as const,
			pool: {
				address: d.lendingPool,
				abi: gapGuardedLendingPoolAbi,
				chainId,
			} as const,
		};
	}, [symbol]);
}

export type PriceBand = {
	low: bigint;
	mid: bigint;
	high: bigint;
	implied: boolean;
};

/** Session state, the stock's live feed round and the price its oracle is publishing right now. */
export function useSessionStatus() {
	const { symbol, feed, oracle } = useStock();
	const now = BigInt(useNow(15));
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
		query: keepWithinStock(symbol),
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

/**
 * When the current 24/5 run of sessions ends. The calendar exposes session boundaries (20:00 ET each day) and
 * isOpen, so read the next week of boundaries and take the first one that is closed.
 */
export function useNextClose() {
	const now = BigInt(useNow(15));
	const day = useReadContract({
		...calendar,
		functionName: "tradingDayOf",
		args: [now],
		query: { placeholderData: keepPreviousData },
	});
	const boundaries = useReadContracts({
		contracts: Array.from({ length: 8 }, (_, k) => ({
			...calendar,
			functionName: "sessionStart" as const,
			args: [(day.data ?? 0n) + BigInt(k + 1)],
		})),
		query: {
			enabled: day.data !== undefined,
			placeholderData: keepPreviousData,
		},
	});
	const starts = (boundaries.data ?? [])
		.map((b) => b.result as bigint | undefined)
		.filter((b): b is bigint => b !== undefined);
	const open = useReadContracts({
		contracts: starts.map((ts) => ({
			...calendar,
			functionName: "isOpen" as const,
			args: [ts],
		})),
		query: { enabled: starts.length > 0, placeholderData: keepPreviousData },
	});
	const firstClosed = open.data?.findIndex((r) => r.result === false) ?? -1;
	return firstClosed >= 0 ? starts[firstClosed] : undefined;
}

export type MarketView = {
	id: bigint;
	feed: `0x${string}`;
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

/** The selected stock's markets, newest first, with live LMSR prices. */
export function useMarkets() {
	const { feed } = useStock();
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
		// Market ids are global, so the previous list stays valid while a new market loads.
		query: { enabled: ids.length > 0, placeholderData: keepPreviousData },
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
					feed: raw.feed as `0x${string}`,
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
			.filter((m): m is MarketView => Boolean(m))
			.filter((m) => m.feed.toLowerCase() === feed.address.toLowerCase());
	}, [details.data, ids, feed.address]);

	return {
		markets,
		isLoading: count.isLoading || details.isLoading,
		refetch: details.refetch,
	};
}

/** Balances and allowances for the connected wallet, for USDG and the selected stock. */
export function useWalletState() {
	const { address } = useAccount();
	const { token, pool } = useStock();
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
				args: [address ?? "0x0", pool.address],
			},
			{
				address: token,
				abi: erc20Abi,
				chainId,
				functionName: "balanceOf",
				args: [address ?? "0x0"],
			},
			{
				address: token,
				abi: erc20Abi,
				chainId,
				functionName: "allowance",
				args: [address ?? "0x0", pool.address],
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

/** The connected wallet's position in the selected stock's demo lending pool. */
export function usePosition() {
	const { address } = useAccount();
	const { pool } = useStock();
	const query = useReadContracts({
		contracts: [
			{ ...pool, functionName: "collateralOf", args: [address ?? "0x0"] },
			{ ...pool, functionName: "debtOf", args: [address ?? "0x0"] },
			{ ...pool, functionName: "maxBorrow", args: [address ?? "0x0"] },
			{ ...pool, functionName: "isLiquidatable", args: [address ?? "0x0"] },
		],
		query: { enabled: Boolean(address) },
	});
	// The pool's prices do not depend on the wallet, so read them even when disconnected.
	const prices = useReadContracts({
		contracts: [
			{ ...pool, functionName: "riskPrice" },
			{ ...pool, functionName: "liquidationPrice" },
		],
	});
	const [collateral, debt, maxBorrow, liquidatable] = query.data ?? [];
	const [riskPrice, liquidationPrice] = prices.data ?? [];
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
	const { pool } = useStock();
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
	const { symbol, feed } = useStock();
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
		query: {
			enabled: candidates.length > 0 && Boolean(market),
			...keepWithinStock(symbol),
		},
	});

	return useMemo(() => {
		if (!market || !rounds.data) return undefined;
		// Read the round id from each result: while a new window loads, the previous window's results stand in,
		// so positions do not line up with `candidates`.
		for (const entry of rounds.data) {
			const result = entry.result as readonly bigint[] | undefined;
			if (!result) continue;
			if (result[3] >= market.reopenTs) return result[0];
		}
		return undefined;
	}, [market, rounds.data]);
}

export {
	gapMarketAbi,
	gapGuardedLendingPoolAbi,
	impliedPriceOracleAbi,
	chainId,
};
