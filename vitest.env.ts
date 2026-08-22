import { existsSync, readFileSync } from "node:fs";

/**
 * Runs in every test worker. The app reads DATABASE_URL; this makes sure a
 * worker can only ever see the test database, never the runtime one.
 */
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set — see vitest.setup.ts");
process.env.DATABASE_URL = testUrl;
