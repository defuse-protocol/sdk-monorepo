import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "index.ts",
		"utils/index": "utils/index.ts",
		"telemetry/types": "telemetry/types.ts",
	},
	format: ["esm", "cjs"],
	platform: "node",
	dts: true,
	unbundle: true,
	define: {
		"import.meta.vitest": "undefined",
	},
});
