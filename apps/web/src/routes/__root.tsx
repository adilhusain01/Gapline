import { robinhoodTestnet } from "@gapline/abi";
import { createRootRoute, Outlet } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { addresses } from "@/lib/gapline";
import { Providers } from "@/providers";

import "../styles.css";

export const Route = createRootRoute({ component: RootComponent });

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
						<a
							className="hover:text-foreground"
							href={`${robinhoodTestnet.blockExplorers.default.url}/address/${addresses.gapMarket}`}
							target="_blank"
							rel="noreferrer"
						>
							GapMarket
						</a>
						<a
							className="hover:text-foreground"
							href={`${robinhoodTestnet.blockExplorers.default.url}/address/${addresses.oracle}`}
							target="_blank"
							rel="noreferrer"
						>
							ImpliedPriceOracle
						</a>
						<a
							className="hover:text-foreground"
							href={`${robinhoodTestnet.blockExplorers.default.url}/address/${addresses.pool}`}
							target="_blank"
							rel="noreferrer"
						>
							LendingPool
						</a>
					</div>
				</footer>
			</div>
		</Providers>
	);
}
