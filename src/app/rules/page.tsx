import Link from "next/link";
import { CHAINS } from "@/lib/chains";
import { BOARD } from "@/lib/config";

export const metadata = { title: "Rules — BIDTAPE" };

export default function RulesPage() {
  return (
    <div className="px-3 py-5 sm:px-4 sm:py-7">
      <Link href="/" className="text-xs text-muted-2 transition-colors hover:text-text">
        ← Back to the board
      </Link>

      <h1 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">Rules</h1>
      <p className="mt-1.5 max-w-lg text-[12.5px] leading-snug text-muted sm:text-sm">
        Short version: rank is the total paid on a contract address. Everything below exists so that
        sentence stays true.
      </p>

      <Section title="Ranking">
        <Rule>
          One list, all chains. Solana, BNB, Base, Ethereum, TON, TRON, Hyperliquid and Robinhood
          Chain compete against each other. There are no per-chain sections.
        </Rule>
        <Rule>
          Rank is the running total paid on a token, not the size of any single bid. A token that
          paid ${BOARD.minBidUsd} fifty times ranks exactly where a token that paid the same amount
          once does.
        </Rule>
        <Rule>
          Equal totals are broken by time. Whoever reached the amount first keeps the higher rank, so
          a spot you paid for never shuffles on its own.
        </Rule>
        <Rule>
          Taking #1 costs at least ${BOARD.topSpotGapUsd} more than the current leader&apos;s total.
          Every other rank is taken by ${BOARD.step} more than the token holding it.
        </Rule>
      </Section>

      <Section title="Bids">
        <Rule>
          New listings start at ${BOARD.minBidUsd}. Top-ups on a token already listed start at $
          {BOARD.minTopUpUsd}. Whole dollars only, up to $
          {BOARD.maxBidUsd.toLocaleString("en-US")} per bid.
        </Rule>
        <Rule>
          A token is identified by its contract address, never by its name. Bidding on an address
          that is already listed adds to that entry&apos;s total. It cannot create a duplicate row,
          whatever name, ticker or links you submit with it.
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

      <Section title="Contract address">
        <Rule>
          The address must be valid for the chain you picked. An EVM address submitted under Solana
          is rejected, and the reverse too.
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
          Query parameters are stripped from every link you submit. Referral, affiliate and tracking
          tags do not survive, and two links that differ only by parameters are one link.
        </Rule>
        <Rule>
          Link shorteners and link-in-bio pages are rejected outright. Their destination can be
          changed after we have accepted it, which makes them unreviewable. Paste the real
          destination.
        </Rule>
        <Rule>
          Chat and invite links belong in the Telegram and Discord fields only. They are not accepted
          as a launchpad link or a website.
        </Rule>
        <Rule>Clicks from the board carry no referrer and no parameters.</Rule>
      </Section>

      <Section title="Accepted launchpads">
        <div className="space-y-2">
          {CHAINS.map((chain) => (
            <div key={chain.id} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
              <span className="w-32 shrink-0 font-semibold" style={{ color: chain.ink }}>
                {chain.name}
              </span>
              <span className="num text-muted-2">{chain.launchpads.join(" · ")}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted-2">
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
          We check that an address is well-formed and that a launchpad link is plausible. We do not
          verify that the person bidding has anything to do with the token.
        </Rule>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">{title}</h2>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </section>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-line pl-3 text-[12.5px] leading-relaxed text-muted sm:text-sm">
      {children}
    </p>
  );
}
