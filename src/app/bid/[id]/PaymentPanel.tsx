"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usd } from "@/lib/format";
import type { PendingStatus } from "@/lib/payments/pending";

type Settled = {
  rank: number;
  previousRank: number | null;
  totalUsd: number;
  toppedUp: boolean;
  name: string;
};

export function PaymentPanel({
  id,
  status,
  failureReason,
  expiresAt,
  paymentAmount,
  walletConfigured,
}: {
  id: string;
  status: PendingStatus;
  failureReason: string | null;
  expiresAt: string;
  /** The exact amount to send, already formatted (e.g. "50.0041"). */
  paymentAmount: string;
  walletConfigured: boolean;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(failureReason);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const expired = status === "expired";

  // Rendered client-side only, so the server markup stays stable and there is
  // no hydration mismatch on a value that changes every second.
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Date.parse(expiresAt) - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setChecking(true);
    try {
      const response = await fetch(`/api/bid/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const data = await response.json();
      if (data.ok) {
        setSettled(data as Settled);
        router.refresh();
      } else {
        setError(data.message ?? "Could not verify that transaction.");
        if (data.status === "expired") router.refresh();
      }
    } catch {
      setError("Could not reach the server. Your payment is unaffected — try again.");
    } finally {
      setChecking(false);
    }
  }

  if (settled) {
    return (
      <div className="mt-5 rounded-card border border-line bg-surface p-4">
        <p className="text-2xs font-bold tracking-widest text-positive uppercase">
          Payment confirmed
        </p>
        <p className="mt-2"><span className="money money-fill text-4xl font-bold">#{settled.rank}</span></p>
        <p className="mt-1.5 text-sm text-muted">
          <span className="font-bold text-text">{settled.name}</span> is at #{settled.rank} with{" "}
          <span className="money">{usd(settled.totalUsd)}</span> total.
          {settled.previousRank !== null && settled.previousRank > settled.rank && (
            <> Moved up from #{settled.previousRank}.</>
          )}
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-pill bg-accent px-4 py-2 text-sm font-bold text-accent-ink"
        >
          See the board
        </button>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <p className="mt-5 rounded-card border border-line bg-surface px-3.5 py-3 text-sm text-muted">
        This bid is already paid and is on the board.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5" noValidate>
      <div className="flex items-baseline justify-between">
        <span className="text-2xs font-bold tracking-widest text-faint uppercase">
          Transaction signature
        </span>
        <span className={`num text-2xs ${expired ? "text-danger" : "text-faint"}`}>
          {expired
            ? "expired"
            : remaining === null
              ? " "
              : remaining === 0
                ? "expired"
                : `${Math.floor(remaining / 60000)}m ${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}s left`}
        </span>
      </div>

      <input
        value={signature}
        onChange={(event) => setSignature(event.target.value)}
        placeholder="Paste the Solana transaction signature"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        disabled={expired || !walletConfigured}
        className="num mt-1.5 w-full rounded-sm border border-line bg-surface px-3 py-2.5 text-xs placeholder:font-sans placeholder:text-faint disabled:opacity-50"
      />

      {error && (
        <p className="mt-2 rounded-sm border border-line bg-surface px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={checking || expired || !walletConfigured || signature.trim().length === 0}
        className="mt-3 w-full rounded-pill bg-accent py-3 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {expired
          ? "Bid expired"
          : checking
            ? "Checking the chain…"
            : `I sent $${paymentAmount} — verify it`}
      </button>

      {expired && (
        <button
          type="button"
          onClick={() => router.push("/bid")}
          className="mt-2 w-full rounded-pill border border-line-strong py-2.5 text-sm text-muted hover:text-text"
        >
          Start a new bid
        </button>
      )}
    </form>
  );
}
