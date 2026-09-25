import { createFileRoute } from "@tanstack/react-router";

import { MarketPage } from "@/components/market-page";

export const Route = createFileRoute("/app/")({ component: MarketPage });
