"use client";

import { useEffect, useState } from "react";

/**
 * Copies a value that has to be transferred character for character.
 *
 * Both things this is used for — the payment amount and the wallet address —
 * fail silently and expensively if they are re-typed with a slip: a wrong
 * amount does not match any bid, and a wrong address sends money nowhere we can
 * find it.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the value is on screen either way.
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="shrink-0 rounded-pill border border-line-strong px-2.5 py-0.5 text-2xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
