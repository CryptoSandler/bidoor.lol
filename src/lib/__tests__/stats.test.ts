import { beforeEach, describe, expect, it } from "vitest";
import { query } from "../db";
import { truncateAll } from "../seed";
import {
  MAX_VISITORS_PER_CALLER,
  ONLINE_WINDOW_SECONDS,
  onlineNow,
  presenceAllowed,
  recordPresence,
  rollUpStats,
  visitorsSinceLaunch,
} from "../stats";

const IP_A = "hash-a";
const IP_B = "hash-b";
const MINUTE = 60_000;

beforeEach(async () => {
  await truncateAll();
});

async function presenceRows(): Promise<number> {
  const r = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM presence`);
  return Number(r[0].n);
}

/**
 * The cost story is the design. If a ping wrote a row, a visitor sitting on the
 * page would be unbounded writes; the primary key is what makes that false.
 */
describe("a heartbeat costs at most one write per bucket", () => {
  it("collapses many pings from one visitor into a single row", async () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) await recordPresence("v1", IP_A, now + i * 100);
    expect(await presenceRows()).toBe(1);
  });

  it("still counts that visitor as one person online", async () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) await recordPresence("v1", IP_A, now + i * 100);
    expect(await onlineNow(now)).toBe(1);
  });

  it("writes a new row once the bucket rolls over", async () => {
    const now = Date.now();
    await recordPresence("v1", IP_A, now);
    await recordPresence("v1", IP_A, now + 61_000);
    expect(await presenceRows()).toBe(2);
    // Two rows, still one person.
    expect(await onlineNow(now + 61_000)).toBe(1);
  });
});

describe("who counts as online", () => {
  it("counts distinct visitors", async () => {
    const now = Date.now();
    await recordPresence("v1", IP_A, now);
    await recordPresence("v2", IP_B, now);
    expect(await onlineNow(now)).toBe(2);
  });

  it("drops anybody older than the window", async () => {
    const now = Date.now();
    await recordPresence("stale", IP_A, now - (ONLINE_WINDOW_SECONDS + 120) * 1000);
    await recordPresence("fresh", IP_B, now);
    expect(await onlineNow(now)).toBe(1);
  });

  it("survives one dropped ping, which is why the window is wider than the interval", async () => {
    const now = Date.now();
    // Pinged 90s ago and missed the next beat: still online at 150s.
    await recordPresence("v1", IP_A, now - 90_000);
    expect(await onlineNow(now)).toBe(1);
  });

  it("reports nobody on an empty board", async () => {
    expect(await onlineNow()).toBe(0);
  });
});

/**
 * Repeat pings are already free, so the only way to inflate "online" is to mint
 * new visitor ids. That is the thing the cap exists for.
 */
describe("one caller cannot mint unlimited visitors", () => {
  it("allows a reasonable number, for households behind one address", async () => {
    const now = Date.now();
    for (let i = 0; i < MAX_VISITORS_PER_CALLER; i++) {
      expect(await presenceAllowed(`v${i}`, IP_A, now)).toBe(true);
      await recordPresence(`v${i}`, IP_A, now);
    }
    expect(await onlineNow(now)).toBe(MAX_VISITORS_PER_CALLER);
  });

  it("refuses the next new id from that caller", async () => {
    const now = Date.now();
    for (let i = 0; i < MAX_VISITORS_PER_CALLER; i++) await recordPresence(`v${i}`, IP_A, now);
    expect(await presenceAllowed("one-too-many", IP_A, now)).toBe(false);
  });

  it("keeps letting an id it already counted keep pinging", async () => {
    const now = Date.now();
    for (let i = 0; i < MAX_VISITORS_PER_CALLER; i++) await recordPresence(`v${i}`, IP_A, now);
    // Otherwise the cap would silently evict the very people it counted.
    expect(await presenceAllowed("v0", IP_A, now)).toBe(true);
  });

  it("does not let one caller's cap block another", async () => {
    const now = Date.now();
    for (let i = 0; i < MAX_VISITORS_PER_CALLER; i++) await recordPresence(`v${i}`, IP_A, now);
    expect(await presenceAllowed("someone-else", IP_B, now)).toBe(true);
  });
});

describe("visitors since launch", () => {
  it("counts a caller once a day however many times they ping", async () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) await recordPresence(`v${i}`, IP_A, now);
    expect(await visitorsSinceLaunch(now)).toBe(1);
  });

  it("counts two callers separately", async () => {
    const now = Date.now();
    await recordPresence("v1", IP_A, now);
    await recordPresence("v2", IP_B, now);
    expect(await visitorsSinceLaunch(now)).toBe(2);
  });

  it("adds yesterday's rolled-up total to today's live count", async () => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * MINUTE;
    await recordPresence("old", IP_A, yesterday);
    await rollUpStats(now);
    await recordPresence("new", IP_B, now);
    expect(await visitorsSinceLaunch(now)).toBe(2);
  });
});

describe("the hourly roll-up", () => {
  it("folds finished days and leaves today alone", async () => {
    const now = Date.now();
    await recordPresence("old", IP_A, now - 24 * 60 * MINUTE);
    await recordPresence("today", IP_B, now);

    const outcome = await rollUpStats(now);
    expect(outcome.rolledDays).toBe(1);

    const totals = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM visitor_totals`);
    expect(Number(totals[0].n)).toBe(1);
  });

  it("is idempotent: running it twice does not double the count", async () => {
    const now = Date.now();
    await recordPresence("old", IP_A, now - 24 * 60 * MINUTE);
    await rollUpStats(now);
    await rollUpStats(now);
    const row = await query<{ uniques: number }>(`SELECT uniques FROM visitor_totals`);
    expect(row[0].uniques).toBe(1);
  });

  it("sweeps stale presence but keeps the live window", async () => {
    const now = Date.now();
    await recordPresence("stale", IP_A, now - 30 * MINUTE);
    await recordPresence("live", IP_B, now);
    const outcome = await rollUpStats(now);
    expect(outcome.presenceSwept).toBe(1);
    expect(await onlineNow(now)).toBe(1);
  });
});
