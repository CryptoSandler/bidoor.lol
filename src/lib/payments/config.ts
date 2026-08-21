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

export function solanaRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
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
