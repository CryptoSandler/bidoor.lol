/**
 * Runs in every test worker. The app reads DATABASE_URL; this makes sure a
 * worker can only ever see the test database, never the runtime one.
 */
const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set — see vitest.setup.ts");
process.env.DATABASE_URL = testUrl;
