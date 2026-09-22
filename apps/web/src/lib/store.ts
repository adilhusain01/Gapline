import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

type UiState = {
  theme: Theme;
  selectedMarketId: bigint | null;
  toggleTheme: () => void;
  selectMarket: (id: bigint | null) => void;
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark",
      selectedMarketId: null,
      toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
      selectMarket: (id) => set({ selectedMarketId: id }),
    }),
    {
      name: "gapline-ui",
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);

/** Keeps the document class in sync with the stored theme. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
