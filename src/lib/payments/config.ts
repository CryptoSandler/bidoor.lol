import { checkAddress } from "../addresses";

/**
 * Payment configuration. We only ever RECEIVE: there is no private key, no
 * signing and no withdrawal path anywhere in this project. The wallet is
 * operated entirely outside it, and is supplied by environment.
 */

/**
 * The real USDC mint on Solana mainnet. Hardcoded on purpose: the whole point
 * of checking it is that anyone can deploy a token called "USDC", and a config
 * value for this would just move the attack one level out.
 */
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const USDC_DECIMALS = 6;

/** How long a pending bid holds its price before it has to be started again. */
export const PAYMENT_WINDOW_MINUTES = 30;

/**
 * Payment attribution.
 *
 * A transfer arriving at our wallet says nothing about WHO it is for. To bind a
 * payment to a bid we give every pending bid a unique amount: the bid, plus a
 * random four-decimal fraction of a dollar. A $50 bid becomes "send exactly
 * $50.0041", and that fraction is what identifies it.
 *
 * USDC has six decimals, so a four-decimal fraction leaves two decimal places
 * of headroom and keeps the number short enough to read and re-type. The
 * fraction is drawn from 1..9999 ten-thousandths — never zero, because a round
 * amount is exactly the one we cannot attribute.
 */
export const FRACTION_MIN = 1;
export const FRACTION_MAX = 9999;

/** One ten-thousandth of a dollar, in USDC base units. */
export const FRACTION_UNIT_BASE = 100;

/** The exact amount a bid must be paid with, in USDC base units. */
export function paymentBaseUnits(amountUsd: number, fraction: number): number {
  return amountUsd * 10 ** USDC_DECIMALS + fraction * FRACTION_UNIT_BASE;
}

/**
 * Rate limits on creating pending bids.
 *
 * Creating a pending bid is free and reserves a payment amount, which makes it
 * the cheapest thing on the site to abuse. Two separate ceilings apply: one per
 * caller, and one on how much of a single amount's fraction space can be held
 * at once. See DECISIONES.md §9 and §11.
 */
export const RATE_LIMITS = {
  /** Unpaid bids one caller may hold at the same time. */
  livePendingPerIp: 5,
  /** Bids one caller may start within the rolling window below. */
  createdPerIpPerWindow: 20,
  /** Length of that rolling window, in minutes. */
  windowMinutes: 60,
  /**
   * Unpaid bids that may share a base amount at once.
   *
   * There are 9,999 fractions per amount, so this sits at 5% of the space. The
   * point is not to ration it but to keep allocation far away from the edge:
   * near saturation the random draw starts colliding repeatedly and creation
   * gets slow before it gets impossible.
   */
  livePendingPerAmount: 500,
} as const;

/**
 * Salt for hashing caller IP addresses.
 *
 * Raw IPs are not stored. Without a salt an IPv4 hash is trivially reversible
 * by brute force — the whole space is four billion — so set this in production
 * if the hashes matter to you.
 */
export function rateLimitSalt(): string {
  return process.env.RATE_LIMIT_SALT ?? "";
}

/** Confirmations we require before treating a transfer as settled. */
export const RPC_COMMITMENT = "confirmed";

/**
 * Solana RPC endpoints, tried in order. Comma-separated so a paid provider can
 * be put in front of the public node without a code change; the public endpoint
 * is heavily rate limited and does not always serve historical transactions.
 */
export function solanaRpcUrls(): string[] {
  const configured = process.env.SOLANA_RPC_URL?.split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  return configured?.length ? configured : ["https://api.mainnet-beta.solana.com"];
}

/** Attempts per verification, across all configured endpoints. */
export const RPC_MAX_ATTEMPTS = 3;
/** First backoff step; doubles each retry, capped by RPC_BACKOFF_MAX_MS. */
export const RPC_BACKOFF_MS = 300;
/** Ceiling on a single backoff step, so a retry cannot hold a request open. */
export const RPC_BACKOFF_MAX_MS = 1_200;

/**
 * Tolerance when comparing a transaction's on-chain blockTime against the bid's
 * own window. Our clock and the cluster's are not the same clock; two minutes
 * is generous for skew and far too short to be useful to an attacker hunting a
 * transfer that matches their randomly assigned fraction.
 */
export const BLOCKTIME_SKEW_SECONDS = 120;

/**
 * Rate limits on verification. Bid creation was already capped; verification
 * was not, which let one bid id drive unlimited RPC calls.
 */
export const VERIFY_LIMITS = {
  /** Attempts allowed against a single bid within the window. */
  perBid: 10,
  /** Attempts allowed from one caller within the window, across all bids. */
  perIp: 30,
  windowMinutes: 10,
  /** Minimum gap between two attempts on the same bid, in seconds. */
  minIntervalSeconds: 3,
} as const;

/**
 * How many proxies sit in front of this app and append to x-forwarded-for.
 * Vercel and Cloudflare are one hop. Getting this wrong in the permissive
 * direction hands the caller control of their own rate-limit bucket.
 */
export function trustedProxyHops(): number {
  const configured = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(configured) && configured > 0 ? configured : 1;
}

/**
 * Escape hatch for local development, where there is no proxy and therefore no
 * trustworthy client address. Off by default: in production, being unable to
 * identify a caller must stop bid creation, not silently disable the limits.
 */
export function allowUntrustedClientIp(): boolean {
  return process.env.ALLOW_UNTRUSTED_CLIENT_IP === "true";
}

/**
 * Where someone whose payment did not match is told to go. Not a promise that
 * it is automated — it is a human queue, and the copy says so.
 */
export function supportContact(): string | null {
  return process.env.SUPPORT_CONTACT?.trim() || null;
}

/** Shared secret for the admin console and the reconcile endpoint. */
export function adminToken(): string | null {
  return process.env.ADMIN_TOKEN?.trim() || null;
}

export type WalletConfig =
  | { ok: true; wallet: string }
  | { ok: false; message: string };

/**
 * Read and validate the receiving wallet. Deliberately has no fallback: a
 * default here would mean a misconfigured deploy quietly collects payments to
 * somebody else's address.
 */
export function paymentWallet(): WalletConfig {
  const raw = process.env.PAYMENT_WALLET?.trim();
  if (!raw) {
    return {
      ok: false,
      message:
        "Payments are not configured on this deployment (PAYMENT_WALLET is unset).",
    };
  }

  const checked = checkAddress("solana", raw);
  if (!checked.ok) {
    return { ok: false, message: `PAYMENT_WALLET is not a valid Solana address: ${checked.reason}` };
  }

  return { ok: true, wallet: checked.canonical };
}

/** Whole dollars to USDC base units. Bids are integers, so this is exact. */
export function usdToBaseUnits(amountUsd: number): bigint {
  return BigInt(amountUsd) * 10n ** BigInt(USDC_DECIMALS);
}
