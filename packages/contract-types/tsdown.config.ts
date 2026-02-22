import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/validate.ts"],
	format: ["esm", "cjs"],
	platform: "neutral",
	dts: true,
	unbundle: true,
	define: {
		"import.meta.vitest": "undefined",
	},
});
