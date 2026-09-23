import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { MAINNET_STOCKS, type StockSymbol } from "@gapline/abi";

import { log } from "./chain";
import { config } from "./config";

const View = z.object({
  drift_pct: z.number().describe("Expected reopening move vs Friday close, in percent"),
  confidence: z.number().describe("0 to 1: how much the news should move the forecast"),
  rationale: z.string().describe("One or two sentences citing the specific news"),
});

export type AnalystView = z.infer<typeof View> & { at: number };

const cache = new Map<StockSymbol, AnalystView>();

/**
 * Optional Claude analyst. Reads weekend news about the stock with web search and returns a bounded drift.
 * Enabled only when ANTHROPIC_API_KEY (or another Anthropic credential) is configured.
 */
export async function analystView(symbol: StockSymbol, fridayClose: number): Promise<AnalystView | undefined> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return undefined;
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < config.analystEveryMin * 60_000) return cached;
  const name = MAINNET_STOCKS[symbol].name;

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(View) },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      system:
        "You forecast how a US stock will open after the weekend, using only news published since Friday's close. " +
        "Most weekends have no material news; in that case return drift_pct 0 and low confidence rather than inventing a view.",
      messages: [
        {
          role: "user",
          content:
            `${name} (${symbol}) closed Friday at $${fridayClose.toFixed(2)}. Search for ${name} news since Friday's close ` +
            "(company announcements, regulation, leadership, macro, competitor news) and estimate the percent move at Sunday night's reopen.",
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      log("analyst", `no view (stop_reason ${response.stop_reason})`);
      return undefined;
    }
    const view = { ...response.parsed_output, at: Date.now() };
    cache.set(symbol, view);
    log("analyst", `${symbol} drift ${view.drift_pct.toFixed(2)}% conf ${view.confidence.toFixed(2)}: ${view.rationale}`);
    return view;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) log("analyst", "credentials rejected; running without analyst");
    else if (error instanceof Anthropic.RateLimitError) log("analyst", "rate limited; keeping previous view");
    else if (error instanceof Anthropic.APIError) log("analyst", `API error ${error.status}: ${error.message}`);
    else log("analyst", `failed: ${error instanceof Error ? error.message : String(error)}`);
    return cached;
  }
}
