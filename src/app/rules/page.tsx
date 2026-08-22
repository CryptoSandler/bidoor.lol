import Link from "next/link";
import { CHAINS } from "@/lib/chains";
import { BOARD } from "@/lib/config";
import { PAYMENT_WINDOW_MINUTES } from "@/lib/payments/config";
import { usd } from "@/lib/format";

export const metadata = { title: "Rules — BIDOOR" };

export default function RulesPage() {
  return (
    <div className="shell py-6 sm:py-8">
      <Link href="/" className="text-xs text-faint transition-colors hover:text-text">
        ← Back to the board
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">Rules</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Short version: rank is the total paid on a contract address, and the contract address is the
        only thing you control. Everything below exists so that stays true. No edge, no allowlist,
        no cope — just the number.
      </p>

      <Section title="Ranking">
        <Rule>
          One list, all chains. Solana, BNB Chain, Robinhood Chain, Base, Ethereum, TON, TRON and
          Hyperliquid compete against each other. There are no per-chain sections.
        </Rule>
        <Rule>
          Rank is the running total paid on a token, not the size of any single bid. A token that
          paid {usd(BOARD.minBidUsd)} fifty times ranks exactly where a token that paid the same
          amount once does.
        </Rule>
        <Rule>
          Equal totals are broken by time. Whoever reached the amount first keeps the higher rank, so
          a spot you paid for never shuffles on its own.
        </Rule>
        <Rule>
          Taking #1 costs at least {usd(BOARD.topSpotGapUsd)} more than the current leader&apos;s
          total. Every other rank is taken by {usd(BOARD.step)} more than the token holding it.
        </Rule>
      </Section>

      <Section title="Bids">
        <Rule>
          New listings start at {usd(BOARD.minBidUsd)}. Top-ups on a token already listed start at{" "}
          {usd(BOARD.minTopUpUsd)}. Whole dollars only, up to {usd(BOARD.maxBidUsd)} per bid.
        </Rule>
        <Rule>
          A token is identified by its contract address, never by its name. Bidding on an address
          that is already listed adds to that entry&apos;s total. It cannot create a duplicate row.
        </Rule>
        <Rule>
          Because identity is the contract, two tokens sharing a name are two entries, and a token
          that rebrands keeps the one entry it already paid for.
        </Rule>
        <Rule>
          Payment is what claims a rank. Nothing appears on the board on the strength of an
          unfinished checkout.
        </Rule>
      </Section>

      <Section title="Paying">
        <Rule>
          Every bid is paid in <span className="font-bold text-text">USDC on Solana</span>, to one
          fixed wallet, whatever chain the token itself lives on. The address is shown on the payment
          screen for your bid.
        </Rule>
        <Rule>
          Starting a bid creates a pending bid that holds its price for {PAYMENT_WINDOW_MINUTES}{" "}
          minutes, and gives it a payment amount of its own: your bid plus a small unique fraction,
          so a $50 bid is paid as something like $50.0041.
        </Rule>
        <Rule>
          <span className="font-bold text-text">Send exactly that amount.</span> The fraction is how
          we tell your payment apart from everyone else&apos;s — a transfer arriving at our wallet
          carries no other clue about whose bid it is for. Send more or less and it will not match.
        </Rule>
        <Rule>
          The fraction is plumbing, not a fee. Your rank is counted as the round bid amount: a $50
          bid ranks as $50, whatever the last four decimals were.
        </Rule>
        <Rule>
          Paste the transaction signature and we check it against the Solana chain: that it is
          confirmed, that it moved real USDC, that it arrived at our wallet, and that the amount
          matches your bid exactly.
        </Rule>
        <Rule>
          If the amount does not match, the payment is recorded against your bid and is not lost —
          but it does not land on the board on its own, and the transaction is now spent. Getting it
          applied means writing to us and waiting for a person to do it. Send the exact amount and
          you never meet any of this.
        </Rule>
        <Rule>
          <span className="font-bold text-text">
            A transaction can only be presented once, matched or not.
          </span>{" "}
          We record every signature the moment we check it. That is what stops anyone else claiming
          a payment you made — and it also means a transaction that did not match cannot be
          submitted again, by you or by them.
        </Rule>
        <Rule>
          Nothing reaches the board until that check passes. If it fails, the reason is shown, and
          while the window is still open you can pay again and paste the new transaction — a
          different one. If the window closes, the bid expires and you start again at whatever the
          price is then.
        </Rule>
        <Rule>
          <span className="font-bold text-text">
            Bids are final and non-refundable. They are advertising spend, not a deposit.
          </span>{" "}
          We do not hold, return or credit them. Nothing about a rank is guaranteed except that
          somebody paid for it.
        </Rule>
        <Rule>
          Send only USDC on Solana, from a wallet you control. A different token, a different chain,
          or an amount below the bid will not be credited and cannot be recovered. We only ever
          receive — we will never ask you for a key, a seed phrase or a signature request.
        </Rule>
      </Section>

      <Section title="What an entry says">
        <Rule>
          Name, ticker, logo and social links are read from DexScreener by contract address. You do
          not type them, and they are refreshed from the same source every time the entry is topped
          up — so a rebrand follows the token automatically.
        </Rule>
        <Rule>
          This means paying into an entry buys you rank and nothing else. No bidoor can top up
          someone else&apos;s token to rewrite its name or repoint its links.
        </Rule>
        <Rule>
          <span className="font-bold text-text">
            Any token tradeable on DexScreener can be listed.
          </span>{" "}
          That is the only gate. If no DEX knows the address on the chain you picked, the bid is
          rejected rather than creating a nameless row.
        </Rule>
        <Rule>
          The launch link is the only field a bidder supplies, and it is frozen by the first bid on
          an entry. Later bids never change it.
        </Rule>
      </Section>

      <Section title="Contract address">
        <Rule>
          The address must be valid for the chain you picked, and the token must actually trade on
          that chain. An EVM address submitted under Solana is rejected, and the reverse too.
        </Rule>
        <Rule>
          The same address on two different chains is two different tokens and gets two entries.
        </Rule>
        <Rule>
          Address formats that encode the same account more than one way are collapsed into one
          entry — EVM casing, and TON&apos;s bounceable and non-bounceable forms.
        </Rule>
      </Section>

      <Section title="Links">
        <Rule>
          A launch link is optional. Listing needs a contract address on a chain DexScreener knows,
          and nothing else. If you do give a link it must be https and clean, like every other link
          here; if you do not, the row simply shows nothing about where the token came from.
        </Rule>
        <Rule>
          <span className="font-bold text-text">Known launchpads get a verified badge.</span> If the
          link points at a launchpad we recognise for that chain, the row shows a{" "}
          <span className="font-bold text-text">✓</span>. That is all the badge means — it is not
          a review of the token, and its absence is not a warning.
        </Rule>
        <Rule>
          Query parameters are stripped from every link. Referral, affiliate and tracking tags do not
          survive, and two links that differ only by parameters are one link.
        </Rule>
        <Rule>
          Link shorteners and link-in-bio pages are rejected outright. Their destination can be
          changed after we have accepted it, which makes them unreviewable.
        </Rule>
        <Rule>Clicks from the board carry no referrer and no parameters.</Rule>
      </Section>

      <Section title="Recognised launchpads">
        <div className="space-y-2">
          {CHAINS.map((chain) => (
            <div key={chain.id} className="flex flex-wrap items-baseline gap-x-2.5 text-sm">
              <span
                className="w-32 shrink-0 font-bold"
                style={{ color: `var(--bd-chain-${chain.id})` }}
              >
                {chain.name}
              </span>
              <span className="num text-xs text-faint">{chain.launchpads.join(" · ")}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-snug text-faint">
          This list is not a gate. Launching somewhere else does not stop you listing — your row just
          shows without the ✓. Tell us about a launchpad that belongs here and we will add it.
        </p>
      </Section>

      <Section title="Delisting">
        <Rule>
          <span className="font-bold text-text">
            We may remove any entry we believe is a scam or a rug, without a refund.
          </span>{" "}
          Bids are non-refundable, and a delisting is a consequence of behaviour rather than a
          cancelled order.
        </Rule>
        <Rule>
          A delisting frees the rank. The record of it is kept — nothing is deleted — but the total
          stops counting, so relisting that token means paying again from zero.
        </Rule>
        <Rule>
          We are not obliged to delist anything, and not delisting a token is not an endorsement of
          it. See below.
        </Rule>
      </Section>

      <Section title="What this board is not">
        <Rule>
          A rank is proof that someone paid for it and nothing else. It is not an audit, a listing
          approval, or a signal that a token is safe.
        </Rule>
        <Rule>
          Reading metadata from DexScreener proves a token trades somewhere. It does not prove the
          token is honest, and it does not mean the person bidding has anything to do with it.
        </Rule>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-2xs font-bold tracking-widest text-text uppercase">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-line pl-3.5 text-sm leading-relaxed text-muted">{children}</p>
  );
}
