"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usd } from "@/lib/format";

type Candidate = {
  id: string;
  amount: string;
  amountUsd: number;
  contract: string;
  chainId: string;
  status: string;
};

type Sender = {
  feePayer: string | null;
  debited: { owner: string; amountBaseUnits: string }[];
} | null;

type QueueItem = {
  payment: {
    id: string;
    signature: string;
    received: string;
    expected: string;
    reason: string;
    createdAt: string;
    sender: Sender;
  };
  candidates: Candidate[];
};

type Entry = {
  contractKey: string;
  name: string;
  ticker: string;
  chainId: string;
  rank: number;
  totalUsd: number;
};

export function AdminActions({ queue, entries }: { queue: QueueItem[]; entries: Entry[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function call(url: string, body: unknown, key: string) {
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      setMessage(data.ok ? (data.message ?? "Done.") : (data.message ?? "Failed."));
      if (data.ok) router.refresh();
    } catch {
      setMessage("Request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {message && (
        <p className="mb-4 rounded-sm border border-line bg-surface px-3 py-2 text-xs text-muted">
          {message}
        </p>
      )}

      <section>
        <h2 className="text-2xs font-bold tracking-widest text-faint uppercase">
          Unmatched payments · {queue.length} open
        </h2>

        {queue.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nothing waiting. Payments land here when a confirmed transfer reaches the wallet but
            matches no bid&apos;s exact amount.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {queue.map((item) => (
              <li key={item.payment.id} className="rounded-card border border-line bg-surface p-3.5">
                <p className="money text-lg font-bold text-text">
                  ${item.payment.received} <span className="text-xs font-normal text-muted">received</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  Bid expected <span className="money">${item.payment.expected}</span> ·{" "}
                  {item.payment.reason} · {new Date(item.payment.createdAt).toUTCString()}
                </p>
                <p className="num mt-1 text-2xs break-all text-faint">{item.payment.signature}</p>

                <SenderPanel sender={item.payment.sender} />

                <p className="mt-3 text-2xs font-bold tracking-widest text-faint uppercase">
                  Closest bids
                </p>
                <p className="text-2xs text-faint">
                  Ranked by amount only. The bid this was filed against was chosen by whoever
                  submitted the signature, not by us. Check the sender above before applying.
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {item.candidates.map((candidate) => (
                    <li key={candidate.id} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="money font-bold">${candidate.amount}</span>
                      <span className="text-faint">{usd(candidate.amountUsd)} bid</span>
                      <span className="text-faint">{candidate.chainId}</span>
                      <span className="text-faint">{candidate.status}</span>
                      <span className="num truncate text-faint">
                        {candidate.contract.slice(0, 10)}…
                      </span>
                      <button
                        disabled={busy !== null}
                        onClick={() =>
                          call(
                            "/api/admin/unmatched",
                            { id: item.payment.id, action: "apply", bidId: candidate.id },
                            `${item.payment.id}:${candidate.id}`,
                          )
                        }
                        className="ml-auto rounded-pill bg-accent px-2.5 py-0.5 text-2xs font-bold text-accent-ink disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </li>
                  ))}
                </ul>

                <DiscardForm
                  disabled={busy !== null}
                  onDiscard={(note) =>
                    call(
                      "/api/admin/unmatched",
                      { id: item.payment.id, action: "discard", note },
                      `${item.payment.id}:discard`,
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-9">
        <h2 className="text-2xs font-bold tracking-widest text-faint uppercase">
          Board · {entries.length} entries
        </h2>
        <p className="mt-1.5 text-xs leading-snug text-faint">
          Delisting removes an entry from the board and does not refund anything. The record is kept,
          and a relisting starts from zero. The old total does not come back.
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {entries.map((entry) => (
            <DelistRow
              key={entry.contractKey}
              entry={entry}
              disabled={busy !== null}
              onDelist={(reason) =>
                call("/api/admin/delist", { contractKey: entry.contractKey, reason }, entry.contractKey)
              }
            />
          ))}
        </ul>
      </section>
    </>
  );
}

function DiscardForm({
  disabled,
  onDiscard,
}: {
  disabled: boolean;
  onDiscard: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 flex gap-2 border-t border-line pt-3">
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Reason for discarding"
        className="min-w-0 flex-1 rounded-sm border border-line bg-bg px-2.5 py-1.5 text-xs"
      />
      <button
        disabled={disabled || note.trim().length === 0}
        onClick={() => onDiscard(note.trim())}
        className="rounded-pill border border-line-strong px-3 py-1 text-2xs text-muted disabled:opacity-50"
      >
        Discard
      </button>
    </div>
  );
}

function DelistRow({
  entry,
  disabled,
  onDelist,
}: {
  entry: Entry;
  disabled: boolean;
  onDelist: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <li className="border-b border-line py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="num text-faint">#{entry.rank}</span>
        <span className="font-bold">{entry.name}</span>
        <span className="num text-faint">{entry.ticker}</span>
        <span className="text-faint">{entry.chainId}</span>
        <span className="money ml-auto font-bold">{usd(entry.totalUsd)}</span>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-pill border border-line-strong px-2.5 py-0.5 text-2xs text-muted"
        >
          {open ? "Cancel" : "Delist"}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex gap-2">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (shown in the audit log)"
            className="min-w-0 flex-1 rounded-sm border border-line bg-bg px-2.5 py-1.5 text-xs"
          />
          <button
            disabled={disabled || reason.trim().length === 0}
            onClick={() => onDelist(reason.trim())}
            className="rounded-pill bg-danger px-3 py-1 text-2xs font-bold text-bg disabled:opacity-50"
            style={{ color: "var(--bd-bg)" }}
          >
            Confirm delist
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Who the chain says paid.
 *
 * The queue used to show a stray payment next to a bid id, and that id came
 * from whoever pasted the signature. Applying on that basis is how an operator
 * gets talked into paying an attacker's rank with a stranger's money. This is
 * the one fact in the row the claimant cannot choose.
 */
function SenderPanel({ sender }: { sender: Sender }) {
  if (!sender || (!sender.feePayer && sender.debited.length === 0)) {
    return (
      <p className="mt-3 rounded-sm border border-line bg-bg px-2.5 py-2 text-2xs text-danger">
        Sender unknown: this payment was recorded before senders were captured. Verify it on a
        block explorer before applying it to anything.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-sm border border-line border-l-[4px] border-l-line-strong bg-surface-2 px-2.5 py-2">
      <p className="text-2xs font-bold tracking-widest text-faint uppercase">Paid by</p>
      {sender.debited.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {sender.debited.map((entry) => (
            <li key={entry.owner} className="num text-2xs break-all">
              {entry.owner}{" "}
              <span className="text-faint">
                (−{(Number(entry.amountBaseUnits) / 1_000_000).toFixed(6)} USDC)
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-2xs text-muted">No USDC was debited from any single wallet.</p>
      )}
      {sender.feePayer && (
        <p className="num mt-1 text-2xs break-all text-faint">fee payer: {sender.feePayer}</p>
      )}
      {sender.debited.length > 1 && (
        <p className="mt-1 text-2xs text-danger">
          More than one wallet was debited. Look harder, not less.
        </p>
      )}
    </div>
  );
}
