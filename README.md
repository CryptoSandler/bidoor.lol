# BIDTAPE

A pay-to-rank leaderboard for crypto tokens. One board, eight chains, one number that decides
everything: the total paid on a contract address.

This is a design and mechanics prototype — **mock data, no payments, nothing persisted**.

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
| Launchpad domain must match the selected chain | `src/lib/chains.ts`, `src/lib/validation.ts` |
| No URL shorteners or link-in-bio pages | `src/lib/links.ts` |
| Query parameters stripped from every link | `src/lib/links.ts` |
| Chat/invite links only in their own fields | `src/lib/links.ts` |
| Same contract = one entry, always | `src/lib/store.ts` |
| Token must exist on a DEX to be listed | `src/lib/dexscreener.ts` |
| Name, ticker, logo and socials come from DexScreener, not the bidder | `src/lib/dexscreener.ts` |
| Launchpad link frozen by the first bid | `src/lib/store.ts` |

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

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

## Not built yet

Payments, persistence, moderation, rate limiting, on-chain address verification, pagination.
See `DECISIONES.md` for the full analysis of what is missing and what could go wrong.

## Documents

- `REFERENCIA.md` — analysis of the reference product's mechanics and rules (Spanish).
- `DESIGN.md` — design tokens and layout patterns, and what we changed (Spanish).
- `DECISIONES.md` — design critique, risks, and open product questions (Spanish).
