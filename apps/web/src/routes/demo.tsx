import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { DemoPanel, useDemoState } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demo")({ component: DemoLayout });

/** The dashboard on the demo fork (apps/demo): same pages as /app, plus the weekend controls. */
function DemoLayout() {
	const demo = useDemoState();
	const state = demo.data;
	const ready =
		state?.phase === "saturday" ||
		state?.phase === "reopening" ||
		state?.phase === "settled";

	return (
		<>
			<AppHeader base="/demo" />
			<main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
				{ready && state ? (
					<>
						<DemoPanel state={state} />
						<Outlet />
					</>
				) : (
					<div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
						{state?.phase === "error" || demo.isError ? (
							<>
								<p className="font-medium">The demo is not available</p>
								<p className="text-sm text-muted-foreground">
									{state?.error ||
										"The demo service did not answer. Try again in a minute."}
								</p>
								<Button variant="outline" asChild>
									<a href="/app">Open the live app instead</a>
								</Button>
							</>
						) : (
							<>
								<Loader2 className="size-5 animate-spin text-band" />
								<p className="font-medium">Setting up the demo weekend</p>
								<p className="text-sm text-muted-foreground">
									Copying the chain, moving its clock to Saturday and letting
									the agent open both markets. This takes about a minute.
								</p>
							</>
						)}
					</div>
				)}
			</main>
			<footer className="border-t">
				<div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted-foreground">
					Demo on a private copy of Robinhood Chain testnet. Transactions here
					are not on the public explorer.
				</div>
			</footer>
		</>
	);
}
