"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The hero's action row: paste an address, land on the bid form with it filled
 * in. Same shape as the reference's "paste your URL and outbid" row — one
 * input, one button, no decisions to make before you are on the next screen.
 */
export function HeroSearch() {
  const router = useRouter();
  const [address, setAddress] = useState("");

  function go(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = address.trim();
    router.push(trimmed ? `/bid?address=${encodeURIComponent(trimmed)}` : "/bid");
  }

  return (
    <form onSubmit={go} className="mt-4 flex flex-col gap-1.5 sm:mt-5 sm:flex-row sm:gap-2">
      <input
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="Paste a token contract address"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="Token contract address"
        className="num min-w-0 flex-1 rounded-pill border border-line bg-surface px-4 py-2.5 text-sm placeholder:font-sans sm:py-3 placeholder:text-faint"
      />
      <button
        type="submit"
        className="rounded-pill bg-accent px-6 py-2.5 text-sm font-bold sm:py-3 text-accent-ink transition-opacity hover:opacity-90"
      >
        Outbid
      </button>
    </form>
  );
}
