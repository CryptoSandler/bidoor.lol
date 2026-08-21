import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Postgres, via node-postgres.
 *
 * `pg` rather than an ORM because the SQL in this project was read line by line
 * in a security audit; porting it to a query builder would rewrite every
 * statement and throw that review away. Parameterised binding is kept exactly
 * as it was — there is no string interpolation in any query.
 *
 * The move off a local SQLite file is not about features. Every guarantee this
 * product leans on is a UNIQUE constraint, and on a file-per-machine database
 * those constraints are per instance: two instances would each happily accept
 * the same transaction signature. In Postgres they are global, which is the
 * only version of that promise worth making.
 */

const globalRef = globalThis as unknown as { __pgPool?: Pool };

export class DatabaseNotConfigured extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. There is deliberately no default: a fallback would " +
        "mean running against the wrong database rather than failing.",
    );
    this.name = "DatabaseNotConfigured";
  }
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseNotConfigured();
  return url;
}

export function pool(): Pool {
  if (globalRef.__pgPool) return globalRef.__pgPool;

  const created = new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // A pool error must not take the process down; the next query will surface it.
  created.on("error", () => {});

  globalRef.__pgPool = created;
  return created;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params: unknown[] = []): Promise<number> {
  const result = await pool().query(text, params);
  return result.rowCount ?? 0;
}

/** Runs a unit of work inside one transaction, rolling back on any throw. */
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** True when an error is a unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}

/** Which constraint a unique violation came from, so callers can tell them apart. */
export function violatedConstraint(error: unknown): string {
  return (error as { constraint?: string })?.constraint ?? "";
}

/** Closes the pool. Used by tests to simulate a fresh instance. */
export async function closePool(): Promise<void> {
  const existing = globalRef.__pgPool;
  delete globalRef.__pgPool;
  if (existing) await existing.end();
}
