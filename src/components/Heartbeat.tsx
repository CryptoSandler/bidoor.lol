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
    <p className="money inline-flex items-center gap-2 rounded-pill bg-surface-2 px-3.5 py-1.5 text-xs text-muted">
      {/* The one live thing on the page, so the dot is slime: it is a status
          indicator, not decoration, and it is the only accent in this pill. */}
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-pill bg-accent" />
      <span className="font-bold text-text">{compactCount(shown)} online</span>
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap">
        {initialVisitors.toLocaleString("en-US")} visitor{initialVisitors === 1 ? "" : "s"} since
        launch
      </span>
      {/* First thing to go when three figures will not fit a 375px screen: it
          is a link to a page, not a number. */}
      <span aria-hidden className="hidden sm:inline">·</span>
      <a href="/stats" className="hidden underline hover:text-text sm:inline">
        see stats
      </a>
    </p>
  );
}
