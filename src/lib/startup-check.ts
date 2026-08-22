/**
 * Configuration that must be present before the server takes traffic.
 *
 * Checked at startup rather than on first use so a missing value fails the
 * deployment, not somebody's first bid. Each entry says what breaks without it,
 * because "MISSING_ENV_VAR" at 3am is not an error message.
 */
export type ConfigProblem = { variable: string; consequence: string };

export function requiredConfigProblems(): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  if (!process.env.DATABASE_URL?.trim()) {
    problems.push({
      variable: "DATABASE_URL",
      consequence: "Nothing can be read or written. The site cannot serve a single page.",
    });
  }

  if (!process.env.PAYMENT_WALLET?.trim()) {
    problems.push({
      variable: "PAYMENT_WALLET",
      consequence: "Bids are refused, because there is nowhere to be paid.",
    });
  }

  if (isProduction && !process.env.RATE_LIMIT_SALT?.trim()) {
    problems.push({
      variable: "RATE_LIMIT_SALT",
      consequence:
        "Caller identifiers would be unsalted hashes of IP addresses, which are reversible " +
        "by brute force — stored visitor IPs wearing a disguise.",
    });
  }

  if (isProduction && !process.env.SITE_URL?.trim()) {
    problems.push({
      variable: "SITE_URL",
      consequence: "Link previews point at localhost, so every shared link has a broken card.",
    });
  }

  if (!process.env.ADMIN_TOKEN?.trim() && !process.env.ADMIN_TOKENS?.trim()) {
    problems.push({
      variable: "ADMIN_TOKEN",
      consequence:
        "The admin console and /api/reconcile are unavailable, so a payment that settles " +
        "without reaching the board can never be repaired.",
    });
  }

  return problems;
}

/** Throws in production, warns elsewhere. */
export function assertConfigured(): void {
  const problems = requiredConfigProblems();
  if (problems.length === 0) return;

  const report = problems
    .map((problem) => `  ${problem.variable} — ${problem.consequence}`)
    .join("\n");

  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing required configuration:\n${report}`);
  }
  console.warn(`[bidoor] configuration incomplete (fatal in production):\n${report}`);
}
