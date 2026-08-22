import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.setup.ts"],
    setupFiles: ["./vitest.env.ts"],
    // Tests share one database and truncate between cases, so they cannot run
    // in parallel against each other.
    fileParallelism: false,
    // Headroom for a hosted database: every query is a network round-trip, so
    // the local default is far too tight against Neon.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      PAYMENT_WALLET: "8vQ2mQ6xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt",
      ALLOW_UNTRUSTED_CLIENT_IP: "true",
      // TEST_DATABASE_URL is a throwaway by contract — the suite truncates it —
      // and it may well be remote, so the locality guard is overridden here and
      // only here.
      LOAD_DEMO_SEED: "force",
    },
  },
});
