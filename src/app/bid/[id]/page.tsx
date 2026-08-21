import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentPanel } from "./PaymentPanel";
import { getChain } from "@/lib/chains";
import { usd } from "@/lib/format";
import { PAYMENT_WINDOW_MINUTES, paymentWallet } from "@/lib/payments/config";
import { getPendingBid } from "@/lib/payments/pending";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bid = getPendingBid(id);
  if (!bid) notFound();

  const wallet = paymentWallet();
  const chain = getChain(bid.chainId);

  return (
    <div className="shell py-6 sm:py-8">
      <Link href="/" className="text-xs text-faint transition-colors hover:text-text">
        ← Back to the board
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">Pay for your bid</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Send exactly this amount in USDC on Solana, then paste the transaction signature below. Your
        rank appears once the transfer is confirmed on-chain — not before.
      </p>

      <dl className="mt-5 grid gap-px overflow-hidden rounded-card border border-line bg-line">
        <Cell label="Token">
          <span className="font-bold">{bid.contract.slice(0, 6)}…{bid.contract.slice(-6)}</span>
          <span className="ml-2 text-xs text-muted">on {chain?.name ?? bid.chainId}</span>
        </Cell>
        <Cell label="Amount to send">
          <span className="money text-xl font-bold text-accent">{usd(bid.amountUsd)}</span>
          <span className="ml-2 text-xs text-muted">USDC on Solana</span>
        </Cell>
        <Cell label="Send to">
          {wallet.ok ? (
            <span className="num text-xs break-all">{wallet.wallet}</span>
          ) : (
            <span className="text-xs text-danger">{wallet.message}</span>
          )}
        </Cell>
      </dl>

      <PaymentPanel
        id={bid.id}
        status={bid.status}
        failureReason={bid.failureReason}
        expiresAt={bid.expiresAt}
        amountUsd={bid.amountUsd}
        walletConfigured={wallet.ok}
      />

      <div className="mt-7 space-y-2.5 border-t border-line pt-5 text-xs leading-relaxed text-faint">
        <p>
          <span className="font-bold text-muted">Bids are final and non-refundable.</span> A bid is
          advertising spend, not a deposit, and it is not held for you or returned.
        </p>
        <p>
          This bid holds its price for {PAYMENT_WINDOW_MINUTES} minutes. After that the board has
          moved on and you will need to start a new one.
        </p>
        <p>
          Send only USDC on Solana, from a wallet you control. Anything else — a different token, a
          different chain, an exchange withdrawal that arrives from an address we cannot match — will
          not be credited and cannot be recovered.
        </p>
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <dt className="text-2xs font-bold tracking-widest text-faint uppercase">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline">{children}</dd>
    </div>
  );
}
