/**
 * Mobile layout guard.
 *
 * The product's distribution channel is a screenshot pasted into X or Telegram,
 * so "the top three are visible without scrolling on a phone" is a hard
 * requirement, not a nicety. This asserts it against real phone viewports and
 * also catches horizontal overflow, which quietly ruins a screenshot.
 *
 * Usage: npm run dev, then `npm run check:layout`.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "Pixel 7", width: 412, height: 915 },
];
const REQUIRED_ROWS = 3;

const browser = await chromium.launch();
let failed = false;

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await page.goto(BASE, { waitUntil: "networkidle" });

  const rows = page.locator("ol > li");
  if ((await rows.count()) < REQUIRED_ROWS) {
    throw new Error(`Board rendered fewer than ${REQUIRED_ROWS} rows.`);
  }

  const last = await rows.nth(REQUIRED_ROWS - 1).boundingBox();
  const bottom = Math.round(last.y + last.height);
  const fits = bottom <= viewport.height;

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const noSideScroll = scrollWidth <= viewport.width;

  if (!fits || !noSideScroll) failed = true;
  console.log(
    `${fits && noSideScroll ? "PASS" : "FAIL"}  ${viewport.name.padEnd(10)} ` +
      `${viewport.width}x${viewport.height} — top ${REQUIRED_ROWS} end at ${bottom}px ` +
      `(${viewport.height - bottom}px spare)` +
      (noSideScroll ? "" : `, horizontal overflow ${scrollWidth}px`),
  );

  await page.close();
}

await browser.close();
if (failed) {
  console.error("\nLayout check failed: the top three must fit one phone screen.");
  process.exit(1);
}
console.log("\nLayout check passed.");
