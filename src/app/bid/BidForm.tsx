"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CHAINS, type ChainId } from "@/lib/chains";
import { BOARD } from "@/lib/config";
import { contractKeyFor, validateBid, type FieldErrors } from "@/lib/validation";

export type ListingIndex = Record<string, { name: string; rank: number; totalUsd: number }>;

type Result = {
  toppedUp: boolean;
  previousRank: number | null;
  rank: number;
  totalUsd: number;
  name: string;
  ticker: string;
  strippedParams: string[];
};

const EMPTY = {
  chainId: "solana" as ChainId,
  contract: "",
  name: "",
  ticker: "",
  logoUrl: "",
  launchpadUrl: "",
  website: "",
  x: "",
  telegram: "",
  discord: "",
  amountUsd: "",
};

export function BidForm({
  index,
  suggestedAmount,
}: {
  index: ListingIndex;
  suggestedAmount: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY, amountUsd: String(suggestedAmount) });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const chain = CHAINS.find((item) => item.id === form.chainId)!;

  // The same validator the server runs. Sharing it means the inline hints can
  // never disagree with what the API will actually accept.
  const existing = useMemo(() => {
    const key = contractKeyFor(form.chainId, form.contract);
    if (!key) return null;
    const listed = index[key] ?? index[key.toLowerCase()];
    return listed ? { contractKey: key, ...listed } : null;
  }, [form.chainId, form.contract, index]);

  const minimum = existing ? BOARD.minTopUpUsd : BOARD.minBidUsd;

  function set<K extends keyof typeof EMPTY>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);

    const local = validateBid(
      { ...form, amountUsd: form.amountUsd },
      existing ? { contractKey: existing.contractKey, totalUsd: existing.totalUsd } : null,
    );
    if (!local.ok) {
      setErrors(local.errors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!data.ok) {
        setErrors(data.errors ?? {});
        return;
      }
      setResult(data as Result);
      setForm({ ...EMPTY, amountUsd: String(BOARD.minBidUsd) });
      router.refresh();
    } catch {
      setErrors({ amountUsd: "Something went wrong. Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mt-5 rounded-[6px] border border-line bg-surface p-4">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-up uppercase">
          {result.toppedUp ? "Bid added" : "Listed"}
        </p>
        <p className="num mt-2 text-3xl font-bold text-gold">#{result.rank}</p>
        <p className="mt-1 text-sm text-muted">
          <span className="font-semibold text-text">{result.name}</span> is at #{result.rank} with{" "}
          <span className="num">${result.totalUsd.toLocaleString("en-US")}</span> total.
          {result.toppedUp && result.previousRank !== null && result.previousRank > result.rank && (
            <> Moved up from #{result.previousRank}.</>
          )}
          {result.toppedUp && result.previousRank === result.rank && <> Rank unchanged.</>}
        </p>
        {result.strippedParams.length > 0 && (
          <p className="mt-2 text-xs text-muted-2">
            Removed {result.strippedParams.length} query parameter
            {result.strippedParams.length > 1 ? "s" : ""} from your links:{" "}
            <span className="num">{result.strippedParams.join(", ")}</span>.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => router.push("/")}
            className="rounded-[4px] bg-accent px-3 py-1.5 text-sm font-semibold text-black"
          >
            See the board
          </button>
          <button
            onClick={() => setResult(null)}
            className="rounded-[4px] border border-line-bright px-3 py-1.5 text-sm text-muted hover:text-text"
          >
            Bid again
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-5" noValidate>
      <Field label="Chain" hint="Sets which address format and which launchpads are accepted.">
        <div className="flex flex-wrap gap-1.5">
          {CHAINS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => set("chainId", item.id)}
              aria-pressed={form.chainId === item.id}
              className={`rounded-[3px] border px-2.5 py-1 text-xs font-medium transition-colors ${
                form.chainId === item.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line text-muted hover:border-line-bright hover:text-text"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Contract address" hint={chain.addressHint} error={errors.contract}>
        <input
          value={form.contract}
          onChange={(event) => set("contract", event.target.value)}
          placeholder={chain.addressPlaceholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="num w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-muted-2/75"
        />
        {existing && (
          <p className="mt-1.5 rounded-[3px] border border-gold/25 bg-gold-soft px-2 py-1.5 text-[12px] text-gold">
            Already on the board at #{existing.rank} as {existing.name}. Your bid adds to its{" "}
            <span className="num">${existing.totalUsd.toLocaleString("en-US")}</span> — it will not
            create a second entry.
          </p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Token name" error={errors.name}>
          <input
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Hyperfrog"
            className="w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted-2/75"
          />
        </Field>
        <Field label="Ticker" error={errors.ticker}>
          <input
            value={form.ticker}
            onChange={(event) => set("ticker", event.target.value)}
            placeholder="HFROG"
            className="num w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-sm uppercase placeholder:text-muted-2/75"
          />
        </Field>
      </div>

      <Field
        label="Official launchpad link"
        hint={`Where this token launched. For ${chain.name}: ${chain.launchpads.join(", ")}.`}
        error={errors.launchpadUrl}
      >
        <input
          value={form.launchpadUrl}
          onChange={(event) => set("launchpadUrl", event.target.value)}
          placeholder={`https://${chain.launchpads[0]}/…`}
          spellCheck={false}
          className="w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-muted-2/75"
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-semibold tracking-[0.18em] text-muted-2 uppercase">
          Socials · optional
        </legend>
        <p className="text-[11px] text-muted-2">
          No shorteners and no link-in-bio pages. Query parameters are stripped from everything you
          paste.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="X" error={errors.x}>
            <input
              value={form.x}
              onChange={(event) => set("x", event.target.value)}
              placeholder="@hyperfrogsol"
              className="w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-muted-2/75"
            />
          </Field>
          <Field label="Telegram" error={errors.telegram}>
            <input
              value={form.telegram}
              onChange={(event) => set("telegram", event.target.value)}
              placeholder="https://t.me/…"
              className="w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-muted-2/75"
            />
          </Field>
          <Field label="Website" error={errors.website}>
            <input
              value={form.website}
              onChange={(event) => set("website", event.target.value)}
              placeholder="https://…"
              className="w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-muted-2/75"
            />
          </Field>
          <Field label="Discord" error={errors.discord}>
            <input
              value={form.discord}
              onChange={(event) => set("discord", event.target.value)}
              placeholder="https://discord.gg/…"
              className="w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-muted-2/75"
            />
          </Field>
        </div>
      </fieldset>

      <Field
        label="Amount"
        hint={
          existing
            ? `Top-ups on a listed token start at $${BOARD.minTopUpUsd}.`
            : `New listings start at $${BOARD.minBidUsd}. Whole dollars only.`
        }
        error={errors.amountUsd}
      >
        <div className="flex items-center gap-2">
          <span className="num text-lg text-muted-2">$</span>
          <input
            value={form.amountUsd}
            onChange={(event) => set("amountUsd", event.target.value)}
            inputMode="numeric"
            placeholder={String(minimum)}
            className="num w-40 rounded-[4px] border border-line bg-surface px-3 py-2 text-lg font-semibold"
          />
        </div>
      </Field>

      <div className="rounded-[4px] border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted-2">
        Demo build: no payment is taken and no rank is real. In production the rank is only granted
        once a payment settles.
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-[4px] bg-accent py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Placing…" : existing ? "Add to this token's total" : "Place bid"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-[0.18em] text-muted-2 uppercase">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-2">{hint}</p>
      ) : null}
    </label>
  );
}
