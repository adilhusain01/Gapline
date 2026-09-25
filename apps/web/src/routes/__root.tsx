import { createRootRoute, Outlet } from "@tanstack/react-router";

import { Providers } from "@/providers";

import "../styles.css";

export const Route = createRootRoute({ component: RootComponent });

// Wallet and query state live above every route, so moving between the landing page and the app keeps the
// connection and cached reads.
function RootComponent() {
	return (
		<Providers>
			<div className="flex min-h-screen flex-col bg-background text-foreground">
				<Outlet />
			</div>
		</Providers>
	);
}
