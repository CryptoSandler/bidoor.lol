"use client";

import { useEffect, useState } from "react";
import { compactCount } from "@/lib/format";

/**
 * Presence heartbeat and the hero banner.
 *
 * The visitor id lives in a module-scoped variable and nowhere else: no cookie,
 * no localStorage, no fingerprint. It is gone on reload, which is the point —
 * it can answer "how many tabs are open right now" and cannot answer "who".
 */
function newVisitorId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

const VISITOR = typeof window === "undefined" ? "" : newVisitorId();
const PING_MS = 60_000;

export function Heartbeat({ initialVisitors }: { initialVisitors: number }) {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ visitor: VISITOR }),
        });
        const body = (await res.json()) as { online?: number };
        if (alive && typeof body.online === "number") setOnline(body.online);
      } catch {
        // A missed heartbeat is not worth telling anybody about; the window is
        // wider than the interval precisely so one can be dropped.
      }
    };
    void ping();
    const timer = setInterval(ping, PING_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // The banner is unconditional. It used to hide itself below a threshold, on
  // the theory that "2 online" argued against the board; in practice it meant a
  // launching board looked dead to everyone who visited it. One is the honest
  // floor — the person reading this is online — and it holds before the first
  // ping answers, which is also what keeps the server and client renders equal.
  const shown = Math.max(1, online ?? 1);

  return (
    <p className="money mt-3 text-center text-2xs text-faint sm:text-xs">
      <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-pill bg-accent align-middle" />
      <span className="font-bold text-text">{compactCount(shown)} online</span>
      <span aria-hidden> · </span>
      {initialVisitors.toLocaleString("en-US")} visitors since launch
      <span aria-hidden> · </span>
      <a href="/stats" className="underline hover:text-text">
        see stats
      </a>
    </p>
  );
}
