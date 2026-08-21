import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Every run gets a throwaway database, never the developer's real one.
    env: { DATABASE_PATH: ":memory:", PAYMENT_WALLET: "8vQ2mQ6xkYPfJ7BFhCGDVzWJ1uYTLDXQoK4Vn5wCq3Rt" },
  },
});
