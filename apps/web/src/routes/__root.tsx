import { robinhoodTestnet } from "@gapline/abi";
import { createRootRoute, Outlet } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { addresses, useStock } from "@/lib/gapline";
import { Providers } from "@/providers";

import "../styles.css";

export const Route = createRootRoute({ component: RootComponent });

const explorer = `${robinhoodTestnet.blockExplorers.default.url}/address`;

function ContractLinks() {
	const stock = useStock();
	const links = [
		["GapMarket", addresses.gapMarket],
		["LmsrMath (Stylus)", addresses.lmsrMath],
		[`${stock.symbol} oracle`, stock.oracle.address],
		[`${stock.symbol} lending pool`, stock.pool.address],
	] as const;
	return links.map(([label, address]) => (
		<a
			key={label}
			className="hover:text-foreground"
			href={`${explorer}/${address}`}
			target="_blank"
			rel="noreferrer"
		>
			{label}
		</a>
	));
}

function RootComponent() {
	return (
		<Providers>
			<div className="flex min-h-screen flex-col bg-background text-foreground">
				<AppHeader />
				<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
					<Outlet />
				</main>
				<footer className="border-t">
					<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-xs text-muted-foreground">
						<span>Robinhood Chain testnet - settled in USDG</span>
						<ContractLinks />
					</div>
				</footer>
			</div>
		</Providers>
	);
}
