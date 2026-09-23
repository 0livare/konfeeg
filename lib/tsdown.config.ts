import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  format: {
    esm: { entry: { index: "src/index.ts", browser: "src/browser.ts" } },
    cjs: {},
  },
  dts: true,
  sourcemap: true,
  clean: true,
})
