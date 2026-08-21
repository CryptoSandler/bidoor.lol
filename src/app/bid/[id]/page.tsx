import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentPanel } from "./PaymentPanel";
import { getChain } from "@/lib/chains";
import { usd } from "@/lib/format";
import { PAYMENT_WINDOW_MINUTES, paymentWallet, supportContact } from "@/lib/payments/config";
import { formatUsdc } from "@/lib/payments/solana";
import { getPendingBid } from "@/lib/payments/pending";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bid = await getPendingBid(id);
  if (!bid) notFound();

  const wallet = paymentWallet();
  const support = supportContact();
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
          <span className="money text-xl font-bold text-accent">
            ${formatUsdc(bid.paymentBaseUnits)}
          </span>
          <span className="ml-2 text-xs text-muted">USDC on Solana</span>
          <span className="mt-1.5 w-full text-xs leading-snug text-muted">
            <span className="font-bold text-text">Send exactly this amount</span> — it&apos;s how we
            match your payment to your bid. The odd fraction is intentional and unique to this bid;
            your rank is still counted as {usd(bid.amountUsd)}.
          </span>
        </Cell>
        <Cell label="Send to">
          {wallet.ok ? (
            <span className="num text-xs break-all">{wallet.wallet}</span>
          ) : (
            <span className="text-xs text-danger">{wallet.message}</span>
          )}
        </Cell>
      </dl>

      <div className="mt-4 rounded-card border border-accent-line bg-accent-tint px-3.5 py-3 text-xs leading-relaxed">
        <p className="font-bold text-text">Read this before you send anything.</p>
        <p className="mt-1.5 text-muted">
          A transaction can only be checked <span className="font-bold text-text">once</span>. We
          record every signature the moment we look at it, whether or not it matched — that is what
          stops somebody else claiming your payment. So if you send the wrong amount, you cannot fix
          it by pasting the same transaction again.
        </p>
        <p className="mt-1.5 text-muted">
          Your money is not lost if that happens: the payment is recorded against this bid. But
          getting it applied means{" "}
          {support ? (
            <>
              contacting <span className="font-bold text-text">{support}</span>
            </>
          ) : (
            "contacting support"
          )}{" "}
          and waiting for a person, not retrying. Send the exact amount and skip all of that.
        </p>
      </div>

      <PaymentPanel
        id={bid.id}
        status={bid.status}
        failureReason={bid.failureReason}
        expiresAt={bid.expiresAt}
        paymentAmount={formatUsdc(bid.paymentBaseUnits)}
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
          Send only USDC on Solana, from a wallet you control. A different token, a different chain,
          or an exchange withdrawal we cannot match will not be credited.
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
