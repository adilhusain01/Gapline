import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		viteReact(),
	],
	// Served as gapline.adilhusain.xyz (Caddy) and *.ts.net (Tailscale Funnel); /demo-api is the demo controller (apps/demo)
	preview: {
		allowedHosts: [".ts.net", "gapline.adilhusain.xyz"],
		proxy: { "/demo-api": "http://127.0.0.1:4180" },
	},
	server: { proxy: { "/demo-api": "http://127.0.0.1:4180" } },
});

export default config;
