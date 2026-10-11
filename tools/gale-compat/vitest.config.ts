import { defineConfig } from "vitest/config";
import { RESULTS_FILE } from "./src/meta.ts";

export default defineConfig({
  test: {
    include: ["src/**/*.compat.ts"],
    globalSetup: ["src/setup.ts"],
    // Every LSP step has its own 10-second timeout; this only bounds a test
    // that chains a few of them.
    testTimeout: 30_000,
    reporters: ["default", "json"],
    outputFile: { json: RESULTS_FILE },
  },
});
