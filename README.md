# BIDTAPE

A pay-to-rank leaderboard for crypto tokens. One board, eight chains, one number that decides
everything: the total paid on a contract address.

The board seed is demo data. Payments are real: bids settle against USDC transfers on Solana.

## The mechanic

- Rank is the accumulated total paid on a token. Not the last bid, not engagement, not votes.
- A token is identified by its **contract address**, never by its name. Bidding on an address that
  is already listed adds to that entry's total instead of creating a duplicate row.
- All chains compete in a single ranked list. Chain is a badge on the row, not a section.
- Equal totals break by age: whoever got there first keeps the higher rank.
- Taking #1 costs $5 more than the leader's total; any other rank costs $1 more than its occupant.

## Rules the code actually enforces

| Rule | Where |
|---|---|
| Address format must match the selected chain | `src/lib/addresses.ts` |
| Recognised launchpad earns a verified mark (not a gate) | `src/lib/chains.ts`, `src/lib/validation.ts` |
| No URL shorteners or link-in-bio pages | `src/lib/links.ts` |
| Query parameters stripped from every link | `src/lib/links.ts` |
| Chat/invite links only in their own fields | `src/lib/links.ts` |
| Same contract = one entry, always | `src/lib/store.ts` |
| Any token tradeable on DexScreener can be listed — and only those | `src/lib/dexscreener.ts` |
| Name, ticker, logo and socials come from DexScreener, not the bidder | `src/lib/dexscreener.ts` |
| Launchpad link frozen by the first bid | `src/lib/store.ts` |
| A rank only exists once a payment is confirmed on-chain | `src/lib/payments/solana.ts` |
| One transaction signature pays for exactly one bid | `src/lib/payments/db.ts` |

## Payments

Bids are paid in **USDC on Solana**, to one fixed wallet, whatever chain the listed token lives on.

1. The bid form creates a *pending* bid with an id and a 30-minute deadline. Nothing reaches the
   board at this point.
2. The payment screen shows the wallet and the exact amount, and takes a transaction signature.
3. The server checks that signature against a public Solana RPC: the transaction is confirmed, it
   moved the real USDC mint, it arrived at our wallet, and it covers the bid.
4. Only then is the bid applied to the leaderboard. Failures and expiries are shown with a reason.

A signature can pay for exactly one bid. That is a `UNIQUE` constraint on the payments table, not a
check in application code, so two requests racing with the same signature cannot both win.

**This project only ever receives.** It holds no private key, does no signing, and has no withdrawal
path. The wallet is operated entirely outside it.

## Running it

```bash
npm install
cp .env.example .env.local     # then set PAYMENT_WALLET
npm run dev                    # http://localhost:3000
```

`PAYMENT_WALLET` has no default on purpose — without it the app refuses to take bids rather than
collecting to some other address.

```bash
npm test             # 60 unit tests
npm run check:layout # asserts the top 3 fit one phone screen (needs the dev server up)
npm run build
npm run lint

npx tsx scripts/generate-seed.mts   # refresh the seed snapshot from DexScreener
```

## Design

All styling comes from one file: `src/app/tokens.css`. Colours, type scale, spacing, radii, row
densities and the container width live there and nowhere else — components consume them through
Tailwind's `@theme` mapping and never hardcode a value. Re-skinning is editing that file.

`DESIGN.md` records the patterns the current look is based on and what was deliberately changed.

## Layout

The product's distribution channel is a screenshot pasted into X or Telegram, so the top three
rows must be fully visible on a phone without scrolling. That is a checked invariant, not a hope —
`npm run check:layout` drives a real browser at iPhone SE, iPhone 14 and Pixel 7 viewports and
fails the build if it regresses.

## Chains

Solana · BNB Chain · Robinhood Chain · Base · Ethereum · TON · TRON · Hyperliquid

Each chain carries its own address family and its own launchpad allowlist. See `src/lib/chains.ts`.

## Rate limits

Creating a pending bid is free and reserves a payment amount, so it is capped three ways — all in
`RATE_LIMITS` in `src/lib/payments/config.ts`: live pending bids per caller, bids started per caller
per hour, and how many pending bids may share one base amount. That last cap sits at 5% of the
available fractions so allocation never approaches saturation.

Expired bids are swept inside the limit check itself, on both the allow and the deny path, so a
caller who fills a limit is released by expiry alone with no cleanup job. Raw IPs are never stored,
only a salted hash used as a counting key.

## Not built yet

Moderation, rate limiting, pagination, and — most importantly — any binding between a payment and
the person who made it. The verifier proves *someone* paid; it does not prove it was the person
looking at the screen. See `DECISIONES.md` §8 for that and the rest of the open risks.

## Documents

- `REFERENCIA.md` — analysis of the reference product's mechanics and rules (Spanish).
- `DESIGN.md` — design tokens and layout patterns, and what we changed (Spanish).
- `DECISIONES.md` — design critique, risks, and open product questions (Spanish).
