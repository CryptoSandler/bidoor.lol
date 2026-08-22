import { NextResponse } from "next/server";
import { clientIp, hashIp } from "@/lib/payments/limits";
import { onlineNow, presenceAllowed, recordPresence } from "@/lib/stats";

/**
 * The heartbeat. One call per visitor per minute; the write collapses on the
 * primary key, so a burst costs the same as a single ping.
 *
 * The visitor id is minted by the client and kept in memory only. It is not a
 * cookie, is never stored, and dies on reload — deliberately useless for
 * following anybody, and exactly enough to answer "how many are here now".
 */
export async function POST(request: Request) {
  const identity = clientIp(request);
  // Fails closed like every other limited endpoint: an unidentifiable caller
  // gets no presence rather than an unlimited one.
  if (!identity.ok) {
    return NextResponse.json({ ok: false, online: 0 }, { status: 503 });
  }
  const ipHash = hashIp(identity.ip);

  let visitor = "";
  try {
    visitor = String(((await request.json()) as { visitor?: string }).visitor ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, online: 0 }, { status: 400 });
  }
  // A fixed shape keeps a caller from stuffing anything interesting in here.
  if (!/^[a-z0-9]{8,32}$/.test(visitor)) {
    return NextResponse.json({ ok: false, online: 0 }, { status: 400 });
  }

  if (!(await presenceAllowed(visitor, ipHash))) {
    return NextResponse.json({ ok: false, online: await onlineNow() }, { status: 429 });
  }

  await recordPresence(visitor, ipHash);
  return NextResponse.json({ ok: true, online: await onlineNow() });
}
