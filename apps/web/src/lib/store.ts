import type { StockSymbol } from "@gapline/abi";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

type UiState = {
	theme: Theme;
	stock: StockSymbol;
	selectedMarketId: bigint | null;
	toggleTheme: () => void;
	selectStock: (stock: StockSymbol) => void;
	selectMarket: (id: bigint | null) => void;
};

export const useUi = create<UiState>()(
	persist(
		(set) => ({
			theme: "dark",
			stock: "TSLA",
			selectedMarketId: null,
			toggleTheme: () =>
				set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
			// Market ids are global across stocks, so a new stock starts from its own latest market.
			selectStock: (stock) => set({ stock, selectedMarketId: null }),
			selectMarket: (id) => set({ selectedMarketId: id }),
		}),
		{
			name: "gapline-ui",
			partialize: (state) => ({ theme: state.theme, stock: state.stock }),
		},
	),
);

/** Keeps the document class in sync with the stored theme. */
export function applyTheme(theme: Theme) {
	document.documentElement.classList.toggle("dark", theme === "dark");
}
