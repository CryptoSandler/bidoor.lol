# Deploying BIDOOR to Vercel

Written against commit `e591fca`. Everything here was verified against the real project rather
than assumed — where something is untested, it says so.

---

## 1. Production build

Verified locally with `npm run build`:

```
✓ Compiled successfully
✓ Generating static pages (11/11)
```

| Route | Rendering |
|---|---|
| `/`, `/bid`, `/bid/[id]`, `/admin` | server-rendered on demand |
| `/api/*`, `/go/[id]` | server-rendered on demand |
| `/rules`, `/icon.svg`, `/opengraph-image`, `/_not-found` | static |

Nothing is prerendered that reads the database, so a build does not need a reachable database —
but the **first request** does.

---

## 2. Environment variables

Set these in Vercel under **Settings → Environment Variables**. Everything marked secret should be
scoped to Production (and Preview if you want previews to work), never committed.

### Required — the server refuses to start in production without these

| Variable | Where the value comes from | Secret |
|---|---|---|
| `DATABASE_URL` | Neon → branch `production` → Connect → show password. Use the **`-pooler`** host and `sslmode=verify-full`. | **Yes** |
| `PAYMENT_WALLET` | The Solana wallet that receives USDC. Operated entirely outside this project — it holds no key and cannot spend. | No, but do not publicise |
| `RATE_LIMIT_SALT` | Generate once: `openssl rand -hex 32`. Changing it resets every rate-limit bucket. | **Yes** |
| `SITE_URL` | The public origin, e.g. `https://bidoor.lol`. Used to build absolute URLs for link previews. | No |
| `ADMIN_TOKEN` *or* `ADMIN_TOKENS` | Generate: `openssl rand -hex 32`. `ADMIN_TOKENS` takes `label:secret` pairs so the audit trail can name who acted. | **Yes** |

`src/lib/startup-check.ts` enforces these at boot and names what breaks without each one, so a
missing value fails the deployment rather than somebody's first bid.

### Recommended

| Variable | Value | Secret | Why |
|---|---|---|---|
| `SUPPORT_CONTACT` | An email or @handle a person actually reads | No | Shown to anyone whose payment did not match. Applying a stray payment is manual work from `/admin`. |
| `SOLANA_RPC_URL` | A dedicated provider, comma-separated for fallback | **Yes** (keys are usually in the URL) | Defaults to the public mainnet endpoint, which is heavily rate limited and does not always serve historical transactions. |
| `DATABASE_POOL_MAX` | `1` | No | **Important on serverless.** Defaults to 10, which is one pool of ten per concurrent function instance. See §4. |
| `TRUSTED_PROXY_HOPS` | `1` | No | Defaults to 1, which is correct for Vercel. Only change if another proxy sits in front. |

### Optional

| Variable | Default | Notes |
|---|---|---|
| `ADMIN_STEP_UP_SECRET` | unset | A second secret for destructive actions (applying a payment, delisting). Unset, they work as before. |
| `IP_HASH_RETENTION_DAYS` | `30` | How long a caller identifier is kept before it is nulled out. |

### Must NOT be set in production

| Variable | Why |
|---|---|
| `TEST_DATABASE_URL` | Belongs to the test suite only. The suite truncates every table. |
| `ALLOW_UNTRUSTED_CLIENT_IP` | Development escape hatch. In production it would disable rate limiting entirely by letting an unidentifiable caller through. |
| `LOAD_DEMO_SEED` | Irrelevant — the fixture never loads under `NODE_ENV=production` regardless. Setting it does nothing, so do not set it and imply otherwise. |

---

## 3. Before the first deploy

1. **Run the migrations against the production branch.** Vercel does not run them.
   ```bash
   npm run db:migrate          # uses DATABASE_URL
   ```
   Already applied to both Neon branches as of `e591fca`: `001_initial`, `002_admin_hardening`,
   `003_unmatched_sender`. Re-running is a no-op.

2. **Expect an empty board.** Production starts with no entries and fills only with real, paid
   bids. The demo fixture is development-only and double-guarded.

3. **The reconcile cron is a GitHub Actions workflow**, `.github/workflows/reconcile.yml`, hourly.
   It lives there rather than in Vercel Cron because the endpoint is authenticated with a header
   and Vercel Cron cannot send one.

   - **Secret:** `RECONCILE_TOKEN` — Settings → Secrets and variables → Actions → New repository
     secret. The value is the same string as `ADMIN_TOKEN` in the Vercel environment (or one of the
     secrets from `ADMIN_TOKENS`, the part after the `label:`).
   - **Optional variable:** `RECONCILE_URL` — same screen, Variables tab. Defaults to
     `https://bidoor.lol/api/reconcile`; set it to point at another deployment without editing the
     workflow.
   - Non-2xx fails the run, with 401 and 503 given their own message so the cause is obvious. A run
     that succeeds but leaves payments unresolvable is a **warning**, not a failure — the next run
     retries them.
   - `workflow_dispatch` is enabled, so it can be run by hand from the Actions tab.

   If the token and the deployment ever drift apart, this fails hourly and visibly, which is the
   point.

4. **HSTS `preload` is set.** The header is safe on its own, but do not submit the domain to the
   preload list until you are certain the apex and every subdomain will be HTTPS forever — that
   submission is very hard to undo.

---

## 4. What could break on serverless — audited, not guessed

Checked by grepping the whole of `src/`.

### Safe

- **Rate limiting and the admin lockout live entirely in Postgres.** `pending_bids.ip_hash`,
  `verification_attempts`, `admin_login_attempts` and `admin_sessions` are all tables. No counter
  is held in a module-level variable, so limits hold across every instance rather than per lambda.
  This is the thing that would silently stop working on serverless, and it does not.
- **No filesystem use at runtime.** No `writeFileSync`, `mkdirSync`, `appendFile`, `readFileSync`
  or `readdirSync` anywhere under `src/`. The only file reads are in `scripts/` and the test
  harness, neither of which ships.
- **The board is a database table**, not memory rebuilt at boot.
- **The one module-level `Set`** is the static shortener allowlist in `links.ts` — a constant.
- **`instrumentation.ts` does not touch the database in production.** It validates configuration,
  then returns immediately because the demo seed is disabled.

### Needs attention

- **Connection pool size.** `src/lib/db.ts` defaults to `max: 10` per instance. On serverless every
  concurrent function gets its own pool, so ten concurrent invocations means up to a hundred
  connections. The Neon `-pooler` endpoint absorbs this, but **set `DATABASE_POOL_MAX=1`** and let
  the pooler do the pooling. This is the single most likely cause of a connection-limit incident.
- **The DexScreener cache is per-instance.** `globalThis.__dexCache` with a 60-second TTL. On
  serverless it will be cold far more often, so expect more calls to DexScreener than local
  behaviour suggests. Correctness is unaffected — it is a cache, and the resolver fails closed.
- **Cold starts cost a connection.** Every cold start opens a new pool. With `DATABASE_POOL_MAX=1`
  and the pooler this is fine; without it, it is not.

### Not verified

- **No deploy to Vercel has been performed.** Everything above is from local production builds and
  reading the code. The first real deploy is where `TRUSTED_PROXY_HOPS=1` gets confirmed — if
  `x-forwarded-for` arrives with a different shape, rate limiting fails **closed** and bids are
  refused with a 503, which is loud rather than silent. Check `/api/bid` returns 200 on the first
  deploy.

---

## 5. First smoke test after deploying

1. `GET /` returns the board (empty is correct).
2. `curl -sI https://…/` shows `Content-Security-Policy` and `Strict-Transport-Security`.
3. `POST /api/bid` with a real contract address returns a bid id — **this proves
   `TRUSTED_PROXY_HOPS` is right**, because a wrong value returns 503.
4. `/admin` shows the token form; a wrong token is rejected, and five wrong ones lock you out.
5. `POST /api/reconcile` with `x-admin-token` returns `{"ok":true,...}`.
6. Share a link and confirm the preview card renders — that proves `SITE_URL`.

---

## 6. Known gaps at launch

- **`script-src` still allows `'unsafe-inline'`** for Next's bootstrap. Removing it needs
  per-request nonces.
- **No IP allowlist on the database.** Deferred: Neon's IP Allow rules are Scale-plan only
  (`$0.222`/CU-hour against Launch's `$0.106`). See `AUDITORIA-SEGURIDAD.md`.
- **No accounts**, so no "my bids" and no way to settle a dispute over who controls a row. An
  explicit decision, recorded in `DECISIONES.md` §13.
- **`bidoor.lol` does not currently resolve to Vercel** — see §7.

---

## 7. Blocker at the time of writing: the domain is still parked

`bidoor.lol` does not point at Vercel. Checked 2026-08-22:

```
NS      bidoor.lol       dns1.registrar-servers.com  (Namecheap)
A       bidoor.lol       192.64.119.129              (Namecheap parking)
CNAME   www.bidoor.lol   parkingpage.namecheap.com
```

`https://bidoor.lol/` times out on port 443. Until this is changed, the reconcile workflow will
fail every hour with "Could not reach …", which is correct behaviour but noisy.

Vercel wants one of:

```
A      @     76.76.21.21
CNAME  www   cname.vercel-dns.com
```

Take the exact records from **Vercel → Project → Settings → Domains**, and set them at Namecheap
under **Domain List → Manage → Advanced DNS**, replacing the parking records. Until DNS propagates,
either disable the workflow or point `RECONCILE_URL` at the `*.vercel.app` deployment URL.
