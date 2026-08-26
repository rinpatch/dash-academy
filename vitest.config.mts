import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "server-only": new URL("./scripts/test-support/server-only-stub.ts", import.meta.url).pathname },
    // Resolves the "@/" alias from tsconfig.json rather than restating it here, so the two
    // cannot drift.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // The integration test talks to testnet and waits on blocks.
    testTimeout: 120_000,
    setupFiles: ["./scripts/test-support/load-env.ts"],
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "contracts/**/*.test.ts", "lesson-factory/**/*.test.mjs"],
    // Integration tests hit the live network and cost credits, so they are opt-in via
    // `npm run test:integration` rather than part of the default run.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
