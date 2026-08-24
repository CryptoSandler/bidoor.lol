import { execute, query, queryOne } from "./db";

/**
 * Traffic stats, aggregated at write time.
 *
 * The cost constraint drives the whole shape: a heartbeat that writes per ping
 * is unbounded. Presence is keyed by (visitor, bucket), so every ping inside
 * the same bucket collides on the primary key and is dropped before it dirties
 * a page. A visitor pinging every 60s into a 60s bucket therefore costs about
 * one write per minute, and a burst of pings costs no more than a single one.
 */

/** How wide a presence bucket is. Matches the client's ping interval. */
export const BUCKET_SECONDS = 60;
/** How far back "online now" looks. Wider than the interval so one dropped
 *  ping does not make somebody blink out of existence. */
export const ONLINE_WINDOW_SECONDS = 150;
/** Presence rows older than this are litter; the hourly cron sweeps them. */
const PRESENCE_RETENTION_MINUTES = 10;

function bucketFor(now: number): Date {
  const ms = BUCKET_SECONDS * 1000;
  return new Date(Math.floor(now / ms) * ms);
}

/**
 * Record one heartbeat. Two writes at most, both idempotent: the presence
 * bucket, and the day's unique-visitor row. Neither can grow with ping rate.
 */
export async function recordPresence(visitor: string, ipHash: string, now = Date.now()): Promise<void> {
  await execute(
    `INSERT INTO presence (bucket, visitor, ip_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [bucketFor(now).toISOString(), visitor, ipHash],
  );
  await execute(
    `INSERT INTO visitors (day, ip_hash) VALUES ($1::timestamptz::date, $2) ON CONFLICT DO NOTHING`,
    [new Date(now).toISOString(), ipHash],
  );
}

export async function onlineNow(now = Date.now()): Promise<number> {
  const since = new Date(now - ONLINE_WINDOW_SECONDS * 1000).toISOString();
  const row = await queryOne<{ n: string }>(
    `SELECT COUNT(DISTINCT visitor)::text AS n FROM presence WHERE bucket > $1`,
    [since],
  );
  return Number(row?.n ?? 0);
}

/**
 * Visitors since launch: the rolled-up days plus today, which has not been
 * rolled up yet. Counting `visitors` outright would mean scanning every row
 * ever written, which is the thing the roll-up exists to avoid.
 */
export async function visitorsSinceLaunch(now = Date.now()): Promise<number> {
  const today = new Date(now).toISOString();
  const rolled = await queryOne<{ n: string }>(
    `SELECT COALESCE(SUM(uniques), 0)::text AS n FROM visitor_totals WHERE day < $1::timestamptz::date`,
    [today],
  );
  const live = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM visitors WHERE day = $1::timestamptz::date`,
    [today],
  );
  return Number(rolled?.n ?? 0) + Number(live?.n ?? 0);
}

/**
 * Fold finished days into the counter and sweep stale presence. Runs from the
 * hourly reconcile cron rather than from a request, so no visitor ever pays
 * for it. Re-running is safe: the upsert is by day and the delete is by age.
 */
export async function rollUpStats(now = Date.now()): Promise<{ rolledDays: number; presenceSwept: number }> {
  const today = new Date(now).toISOString();
  const rolled = await query<{ day: string }>(
    `INSERT INTO visitor_totals (day, uniques)
       SELECT day, COUNT(*)::int FROM visitors WHERE day < $1::timestamptz::date GROUP BY day
     ON CONFLICT (day) DO UPDATE SET uniques = EXCLUDED.uniques
     RETURNING day::text`,
    [today],
  );
  const swept = await execute(
    `DELETE FROM presence WHERE bucket < $1`,
    [new Date(now - PRESENCE_RETENTION_MINUTES * 60_000).toISOString()],
  );
  return { rolledDays: rolled.length, presenceSwept: swept };
}

/**
 * How many distinct visitor ids one caller may hold open at once. A household
 * behind one NAT is legitimately several people, so this is generous; it exists
 * to stop somebody minting ids in a loop to inflate "online", not to police
 * families. Rotating ids is the only way to inflate the number, because the
 * primary key already collapses repeat pings from one id.
 */
export const MAX_VISITORS_PER_CALLER = 8;

/** True when this caller may open ANOTHER visitor id right now. */
export async function presenceAllowed(visitor: string, ipHash: string, now = Date.now()): Promise<boolean> {
  const since = new Date(now - ONLINE_WINDOW_SECONDS * 1000).toISOString();
  const row = await queryOne<{ n: string; mine: string }>(
    `SELECT COUNT(DISTINCT visitor)::text AS n,
            COUNT(*) FILTER (WHERE visitor = $2)::text AS mine
       FROM presence WHERE ip_hash = $1 AND bucket > $3`,
    [ipHash, visitor, since],
  );
  // An id already counted costs nothing more: only NEW ids hit the cap.
  if (Number(row?.mine ?? 0) > 0) return true;
  return Number(row?.n ?? 0) < MAX_VISITORS_PER_CALLER;
}
