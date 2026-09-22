@AGENTS.md

## Claude Code notes

- Deployed addresses: read `contracts/deployments/46630.json` (never hardcode them elsewhere; `packages/abi` exports them).
- Keep `AGENTS.md`, `README.md`, `docs/DEMO.md` and `docs/knowledge-graph.{md,json}` in sync with every change,
  in the same commit.
- Long-running processes run under pm2 (`npx pm2 status`); do not start duplicate `npm run dev` / relayer copies.
- Claude API code (agent analyst) uses `@anthropic-ai/sdk`, model `claude-opus-5`, adaptive thinking,
  `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`, structured output via `betaZodOutputFormat`.
