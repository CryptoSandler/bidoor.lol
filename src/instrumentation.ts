/**
 * Runs once when the server starts.
 *
 * Fills an empty board with the demo fixture so local development has something
 * to work against. `loadDemoSeed` refuses under NODE_ENV=production and when the
 * board is already populated, so this is a no-op everywhere it should be.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { demoSeedEnabled, loadDemoSeed } = await import("./lib/seed");
  if (!demoSeedEnabled()) return;

  try {
    const outcome = await loadDemoSeed();
    if (outcome.loaded) console.log(`[bidoor] demo fixture loaded (${outcome.entries} entries)`);
  } catch (error) {
    // Never take the server down for a development convenience. A missing
    // database will surface loudly on the first real query anyway.
    console.warn("[bidoor] demo fixture not loaded:", (error as Error).message);
  }
}
