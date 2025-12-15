import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: ["packages/*"],
		includeSource: ["src/**/*.{js,ts}"],
		coverage: {
			provider: "v8",
			include: ["packages/*/src/**/*.ts"],
			exclude: ["**/*.test.ts", "**/*.spec.ts"],
			reporter: ["text", "json", "html"],
		},
		testTimeout: 20_000,
		watch: false,
	},
});
