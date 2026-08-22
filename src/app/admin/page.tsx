import { AdminActions } from "./AdminActions";
import { adminConfigured, adminSessionLabel, listAdminAudit } from "@/lib/admin";
import { usd } from "@/lib/format";
import { candidateBidsForAmount, listUnmatchedPayments } from "@/lib/payments/pending";
import { formatUsdc } from "@/lib/payments/solana";
import { listDelistings, listRanked } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — bidoor.lol", robots: { index: false, follow: false } };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!adminConfigured()) {
    return (
      <Shell>
        <p className="text-sm text-danger">
          Admin access is not configured. Set <span className="num">ADMIN_TOKEN</span> in the
          environment.
        </p>
      </Shell>
    );
  }

  const actor = await adminSessionLabel();
  if (!actor) {
    return (
      <Shell>
        <form method="POST" action="/api/admin/session" className="max-w-sm">
          <label className="block">
            <span className="text-2xs font-bold tracking-widest text-faint uppercase">
              Admin token
            </span>
            <input
              type="password"
              name="token"
              autoComplete="off"
              className="num mt-1.5 w-full rounded-sm border border-line bg-surface px-3 py-2.5 text-sm"
            />
          </label>
          {error === "locked" ? (
            <p className="mt-2 text-xs text-danger">
              Too many failed attempts from here. Try again shortly.
            </p>
          ) : error ? (
            <p className="mt-2 text-xs text-danger">That token was not accepted.</p>
          ) : null}
          <button
            type="submit"
            className="mt-3 w-full rounded-pill bg-accent py-2.5 text-sm font-bold text-accent-ink"
          >
            Sign in
          </button>
        </form>
      </Shell>
    );
  }

  const open = await listUnmatchedPayments("open");
  const resolved = (await listUnmatchedPayments()).filter((payment) => payment.status !== "open");
  const delistings = await listDelistings();
  const entries = await listRanked();
  const audit = await listAdminAudit(40);

  const queue = await Promise.all(
    open.map(async (payment) => ({
      payment: {
        id: payment.id,
        signature: payment.signature,
        received: formatUsdc(payment.receivedBaseUnits),
        expected: formatUsdc(payment.expectedBaseUnits),
        reason: payment.reason,
        createdAt: payment.createdAt,
        sender: payment.sender,
      },
      candidates: (await candidateBidsForAmount(payment.receivedBaseUnits)).map((bid) => ({
        id: bid.id,
        amount: formatUsdc(bid.paymentBaseUnits),
        amountUsd: bid.amountUsd,
        contract: bid.contract,
        chainId: bid.chainId,
        status: bid.status,
      })),
    })),
  );

  return (
    <Shell>
      <AdminActions
        queue={queue}
        entries={entries.map((entry) => ({
          contractKey: entry.contractKey,
          name: entry.name,
          ticker: entry.ticker,
          chainId: entry.chainId,
          rank: entry.rank,
          totalUsd: entry.totalUsd,
        }))}
      />

      {resolved.length > 0 && (
        <section className="mt-9">
          <h2 className="text-2xs font-bold tracking-widest text-faint uppercase">
            Resolved payments
          </h2>
          <ul className="mt-2.5">
            {resolved.map((payment) => (
              <li key={payment.id} className="border-b border-line py-2 text-xs text-muted">
                <span
                  className={`font-bold ${payment.status === "applied" ? "text-text" : "text-faint"}`}
                >
                  {payment.status}
                </span>{" "}
                · <span className="num">{formatUsdc(payment.receivedBaseUnits)} USDC</span> ·{" "}
                <span className="num break-all">{payment.signature.slice(0, 16)}…</span>
                {payment.resolutionNote && <span className="block text-faint">{payment.resolutionNote}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {delistings.length > 0 && (
        <section className="mt-9">
          <h2 className="text-2xs font-bold tracking-widest text-faint uppercase">Delisted</h2>
          <ul className="mt-2.5">
            {delistings.map((delisting) => (
              <li key={delisting.contractKey} className="border-b border-line py-2 text-xs text-muted">
                <span className="num break-all">{delisting.contractKey}</span>
                <span className="block text-faint">
                  {delisting.reason} · {new Date(delisting.delistedAt).toUTCString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-9">
        <h2 className="text-2xs font-bold tracking-widest text-faint uppercase">Audit trail</h2>
        <p className="mt-1.5 text-xs text-faint">
          Append-only. The database refuses UPDATE, DELETE and TRUNCATE on this table, so nothing
          here can be edited away from the console or from application code.
        </p>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No admin actions recorded yet.</p>
        ) : (
          <ul className="mt-2.5">
            {audit.map((entry) => (
              <li key={entry.id} className="border-b border-line py-2 text-xs text-muted">
                <span className="num text-faint">
                  {new Date(entry.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                </span>{" "}
                <span className="font-bold text-text">{entry.actor}</span>{" "}
                <span className="font-medium text-text">{entry.action}</span>
                {entry.targetId && (
                  <span className="num block truncate text-faint">{entry.targetId}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-9 border-t border-line pt-4 text-xs leading-relaxed text-faint">
        Board total across {entries.length} entries:{" "}
        <span className="money">{usd(entries.reduce((sum, e) => sum + e.totalUsd, 0))}</span>.
        Delisting never deletes anything — the payment record and the delisting both stay.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell py-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <p className="mt-1.5 text-sm text-muted">Operations console. Not linked from anywhere.</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
