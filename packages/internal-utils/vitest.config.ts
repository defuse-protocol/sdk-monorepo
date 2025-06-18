import * as path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
    },
  },
  resolve: {
    alias: {
      // point the deep-import name at the real folder
      "@hot-labs/omni-sdk/build/utils": path.resolve(
        import.meta.dirname,
        "node_modules/@hot-labs/omni-sdk/build/utils"
      ),
    },
  },
})
