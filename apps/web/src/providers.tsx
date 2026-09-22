import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { WagmiProvider } from "wagmi";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyTheme, useUi } from "@/lib/store";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient({
	defaultOptions: { queries: { refetchInterval: 12_000, staleTime: 6_000 } },
});

export function Providers({ children }: { children: ReactNode }) {
	const theme = useUi((state) => state.theme);
	useEffect(() => applyTheme(theme), [theme]);

	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider delayDuration={200}>
					{children}
					<Toaster position="bottom-right" richColors />
				</TooltipProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
}
