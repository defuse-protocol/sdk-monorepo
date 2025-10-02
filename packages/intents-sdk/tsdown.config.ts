import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	unbundle: true,
	define: {
		"import.meta.vitest": "undefined",
	},
});
