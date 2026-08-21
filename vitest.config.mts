import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/" alias from tsconfig.json rather than restating it here, so the two
    // cannot drift.
    tsconfigPaths: true,
  },
  test: {
    // Both suites are pure logic over local files — no DOM, no network. Component tests
    // would need an environment set per-file or a projects entry.
    environment: "node",
    include: ["lib/**/*.test.ts", "contracts/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
