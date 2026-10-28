import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // The migration tests import drizzle-orm cold; under a parallel tsc/lint run that alone can
    // pass the 5 s default and fail the suite for no reason.
    testTimeout: 20_000,
  },
});
