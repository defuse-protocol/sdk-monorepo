import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["index.ts", "src/bridges/omni-bridge/omni-withdraw-params.ts"],
	format: ["esm", "cjs"],
	platform: "neutral",
	dts: true,
	unbundle: true,
	define: {
		"import.meta.vitest": "undefined",
	},
});
