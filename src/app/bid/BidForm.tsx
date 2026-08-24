"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChainBadge } from "@/components/ChainBadge";
import { TokenMark } from "@/components/TokenMark";
import { CHAINS, type ChainId } from "@/lib/chains";
import { BOARD } from "@/lib/config";
import { usd } from "@/lib/format";
import { contractKeyFor, validateBid, type FieldErrors } from "@/lib/validation";

export type ListingIndex = Record<string, { name: string; rank: number; totalUsd: number }>;

type Preview =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; name: string; ticker: string; logoUrl?: string }
  | { state: "error"; message: string };

export function BidForm({
  index,
  suggestedAmount,
  initialAddress,
}: {
  index: ListingIndex;
  suggestedAmount: number;
  initialAddress: string;
}) {
  const router = useRouter();
  const [chainId, setChainId] = useState<ChainId>("solana");
  const [contract, setContract] = useState(initialAddress);
  const [launchpadUrl, setLaunchpadUrl] = useState("");
  const [amountUsd, setAmountUsd] = useState(String(suggestedAmount));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const chain = CHAINS.find((item) => item.id === chainId)!;

  const existing = useMemo(() => {
    const key = contractKeyFor(chainId, contract);
    if (!key) return null;
    const listed = index[key] ?? index[key.toLowerCase()];
    return listed ? { contractKey: key, ...listed } : null;
  }, [chainId, contract, index]);

  const minimum = existing ? BOARD.minTopUpUsd : BOARD.minBidUsd;

  // Resolve the token as they type. Seeing the exact name and logo before
  // paying matters much more now that these fields cannot be typed by hand.
  //
  // Results are cached per lookup key and the preview is *derived* from that
  // cache rather than pushed into state on every keystroke, so going back to an
  // address you already typed is instant and needs no request.
  const lookupKey = useMemo(() => contractKeyFor(chainId, contract), [chainId, contract]);
  const [resolved, setResolved] = useState<Record<string, Preview>>({});
  const requested = useRef<Set<string>>(new Set());

  const preview: Preview = lookupKey
    ? (resolved[lookupKey] ?? { state: "loading" })
    : { state: "idle" };

  useEffect(() => {
    if (!lookupKey || requested.current.has(lookupKey)) return;

    const address = contract.trim();
    const chain = chainId;
    const timer = setTimeout(async () => {
      requested.current.add(lookupKey);
      let next: Preview;
      try {
        const response = await fetch(
          `/api/token?chain=${chain}&address=${encodeURIComponent(address)}`,
        );
        const data = await response.json();
        next = data.ok
          ? { state: "found", name: data.name, ticker: data.ticker, logoUrl: data.logoUrl }
          : { state: "error", message: data.message ?? "Token not found." };
      } catch {
        // A failed lookup must not stick: let the next keystroke retry it.
        requested.current.delete(lookupKey);
        next = { state: "error", message: "Could not reach DexScreener." };
      }
      setResolved((prev) => ({ ...prev, [lookupKey]: next }));
    }, 350);

    return () => clearTimeout(timer);
  }, [lookupKey, chainId, contract]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const form = { chainId, contract, launchpadUrl, amountUsd };
    const local = validateBid(
      form,
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
      // Nothing is on the board yet — the bid now has to be paid for.
      router.push(`/bid/${data.id}`);
    } catch {
      setErrors({ amountUsd: "Something went wrong. Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
      <Field label="Chain" hint="Sets which address format and which launchpads are accepted.">
        <div className="flex flex-wrap gap-1.5">
          {CHAINS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChainId(item.id)}
              aria-pressed={chainId === item.id}
              className={`rounded-pill border px-3 py-1 text-xs font-medium transition-colors ${
                chainId === item.id
                  ? "border-text bg-surface-2 text-text"
                  : "border-line text-muted hover:border-line-strong hover:text-text"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Contract address" hint={chain.addressHint} error={errors.contract}>
        <input
          value={contract}
          onChange={(event) => {
            setContract(event.target.value);
            setErrors((prev) => ({ ...prev, contract: undefined }));
          }}
          placeholder={chain.addressPlaceholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="num w-full rounded-sm border border-line bg-surface px-3 py-2.5 text-sm placeholder:font-sans placeholder:text-faint"
        />

        {preview.state === "loading" && (
          <p className="mt-2 text-xs text-faint">Looking this up on DexScreener…</p>
        )}
        {preview.state === "error" && (
          <p className="mt-2 text-xs text-danger">{preview.message}</p>
        )}
        {preview.state === "found" && (
          <div className="mt-2 flex items-center gap-2.5 rounded-sm border border-line bg-surface-2 px-3 py-2">
            <TokenMark name={preview.name} logoUrl={preview.logoUrl} size="2rem" />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-bold">{preview.name}</span>
                <span className="num text-2xs text-faint">{preview.ticker}</span>
                <ChainBadge chainId={chainId} />
              </span>
              <span className="block text-2xs text-faint">
                Name, ticker, logo and socials come from DexScreener.
              </span>
            </span>
          </div>
        )}

        {existing && (
          <p className="mt-2 rounded-sm border border-line border-l-[4px] border-l-line-strong bg-surface-2 px-3 py-2 text-xs text-text">
            Already on the board at #{existing.rank} as {existing.name}. Your bid adds to its{" "}
            <span className="money">{usd(existing.totalUsd)}</span>. It will not create a second entry,
            and it will not change what the entry says.
          </p>
        )}
      </Field>

      <Field
        label="Where it launched · optional"
        hint={
          existing
            ? "This entry's launch link was frozen by its first bid and will not be changed."
            : `Optional. Any https link. Known launchpads get a verified badge. On ${chain.name} we recognise ${chain.launchpads.join(", ")}.`
        }
        error={errors.launchpadUrl}
      >
        <input
          value={launchpadUrl}
          onChange={(event) => {
            setLaunchpadUrl(event.target.value);
            setErrors((prev) => ({ ...prev, launchpadUrl: undefined }));
          }}
          placeholder={`https://${chain.launchpads[0]}/…`}
          spellCheck={false}
          className="w-full rounded-sm border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-faint"
        />
      </Field>

      <Field
        label="Amount"
        hint={
          existing
            ? `Top-ups on a listed token start at ${usd(BOARD.minTopUpUsd)}.`
            : `New listings start at ${usd(BOARD.minBidUsd)}. Whole dollars only.`
        }
        error={errors.amountUsd}
      >
        <div className="flex items-center gap-2">
          <span className="money text-lg text-faint">$</span>
          <input
            value={amountUsd}
            onChange={(event) => {
              setAmountUsd(event.target.value);
              setErrors((prev) => ({ ...prev, amountUsd: undefined }));
            }}
            inputMode="numeric"
            placeholder={String(minimum)}
            className="money w-40 rounded-sm border border-line bg-surface px-3 py-2.5 text-lg font-bold"
          />
        </div>
      </Field>

      <p className="rounded-sm border border-line bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-faint">
        The next screen shows where to send USDC on Solana, and the exact amount to send. Your rank
        only appears once that transfer is confirmed on-chain. Send the exact amount: a transaction
        can only be checked once. Bids are final and non-refundable.
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-pill bg-accent py-3 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Starting…" : existing ? "Top up this token and continue to payment" : "Continue to payment"}
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
      <span className="text-2xs font-bold tracking-widest text-faint uppercase">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-snug text-faint">{hint}</p>
      ) : null}
    </label>
  );
}
