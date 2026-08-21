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
    env: {
      PAYMENT_WALLET: "8vQ2mQ6xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt",
      ALLOW_UNTRUSTED_CLIENT_IP: "true",
    },
  },
});
