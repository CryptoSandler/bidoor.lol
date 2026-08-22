# BIDOOR

A live auction board for tokens across chains — the top spot goes to the highest bidder.

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in the values

docker compose up -d           # Postgres on localhost:55432
npm run db:migrate             # create the schema
npm run dev                    # http://localhost:3000
```

`npm run db:reset` throws the local database away and rebuilds it from scratch.

## Database

State lives in Postgres — the board, the payment history, and the constraints that make the
payment flow safe. It is not a local file on purpose: every guarantee here is a UNIQUE
constraint, and on a file-per-machine database those are per instance, so two app servers would
each accept the same transaction signature. The client is `pg` rather than an ORM, because the
SQL was read line by line in a security audit and a query builder would rewrite all of it.

Migrations are plain SQL in `migrations/`, applied in filename order by `npm run db:migrate`.
Each is idempotent and records itself in `schema_migrations`.

**Two connection strings, deliberately separate:**

| Variable | Used by | Points at |
|---|---|---|
| `DATABASE_URL` | The app, in every environment | Dev: local Docker. Production: the production database. |
| `TEST_DATABASE_URL` | The test suite, and nothing else | A throwaway database. **Never one with real data.** |

The suite truncates every table between tests, so it reads its own variable and refuses to start
if the two are equal. Both live in `.env.local`, which is gitignored; in production
`DATABASE_URL` is set in the host's environment, never in a file. With Neon, use a **separate
branch** for tests and keep `?sslmode=require` on both.

## Payments

Bids are paid in USDC on Solana to one fixed wallet, set in `PAYMENT_WALLET`. There is no default
and no address in the code: without it the app refuses to take bids. This project only ever
receives — it holds no private key, does no signing, and has no withdrawal path.

## Demo data

An empty board is filled with a demo fixture in development. It never runs under
`NODE_ENV=production`, and `LOAD_DEMO_SEED=false` switches it off anywhere. The production board
starts empty and fills only with real, paid bids.

## Security headers

`next.config.ts` sets CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy` and `Cross-Origin-Opener-Policy` on every response, applied at the edge on
Vercel. `/admin` and `/api/*` additionally get `no-store` and `noindex`.

The CSP still allows `'unsafe-inline'` for scripts, which Next needs for its bootstrap. Removing it
requires per-request nonces — recorded as open in `DECISIONES.md` rather than papered over.

## Checks

```bash
npm test               # unit tests, against a real Postgres
npm run check:layout   # asserts the top 3 fit one phone screen (needs the dev server up)
npm run build
npm run lint
```

## Deploying

See `DEPLOY.md` for the Vercel checklist: environment variables, what to run before the first
deploy, and what was audited for serverless.

## Documents

- `DESIGN.md` — design tokens and layout patterns.
- `REFERENCIA.md` — analysis of the reference product's mechanics (Spanish).
- `DECISIONES.md` — design critique, decisions and open questions (Spanish).
- `AUDITORIA-SEGURIDAD.md` — security audit and remediation status (Spanish).
- `DEPLOY.md` — Vercel deployment checklist.
