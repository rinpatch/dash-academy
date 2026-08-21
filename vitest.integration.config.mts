import { defineConfig } from "vitest/config";

// Integration tests hit the live network and cost credits, so they are opt-in rather than
// part of `npm test`. Kept separate rather than merged from the default config because
// mergeConfig concatenates `include` instead of replacing it.
export default defineConfig({
  resolve: {
    alias: { "server-only": new URL("./scripts/test-support/server-only-stub.ts", import.meta.url).pathname },
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./scripts/test-support/load-env.ts"],
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 120_000,
  },
});
