import Link from "next/link";
import { CHAINS } from "@/lib/chains";
import { BOARD } from "@/lib/config";
import { usd } from "@/lib/format";

export const metadata = { title: "Rules — BIDTAPE" };

export default function RulesPage() {
  return (
    <div className="shell py-6 sm:py-8">
      <Link href="/" className="text-xs text-faint transition-colors hover:text-text">
        ← Back to the board
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">Rules</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Short version: rank is the total paid on a contract address, and the contract address is the
        only thing you control. Everything below exists so that stays true.
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

      <Section title="What an entry says">
        <Rule>
          Name, ticker, logo and social links are read from DexScreener by contract address. You do
          not type them, and they are refreshed from the same source every time the entry is topped
          up — so a rebrand follows the token automatically.
        </Rule>
        <Rule>
          This means paying into an entry buys you rank and nothing else. Nobody can top up someone
          else&apos;s token to rewrite its name or repoint its links.
        </Rule>
        <Rule>
          A token DexScreener has never seen cannot be listed. If no DEX knows the address, the bid
          is rejected rather than creating a nameless row.
        </Rule>
        <Rule>
          The launchpad link is the one field a bidder supplies, and it is frozen by the first bid on
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
          The launchpad link has to be the official launchpad for the chain you selected. A pump.fun
          link on a BNB listing is rejected.
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

      <Section title="Accepted launchpads">
        <div className="space-y-2">
          {CHAINS.map((chain) => (
            <div key={chain.id} className="flex flex-wrap items-baseline gap-x-2.5 text-sm">
              <span
                className="w-32 shrink-0 font-bold"
                style={{ color: `var(--bd-chain-${chain.id}-ink)` }}
              >
                {chain.name}
              </span>
              <span className="num text-xs text-faint">{chain.launchpads.join(" · ")}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-snug text-faint">
          Launched somewhere that is not on this list? Tell us and we will review it. We would rather
          add a real launchpad than accept an arbitrary link.
        </p>
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
      <h2 className="text-2xs font-bold tracking-widest text-accent uppercase">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-line pl-3.5 text-sm leading-relaxed text-muted">{children}</p>
  );
}
