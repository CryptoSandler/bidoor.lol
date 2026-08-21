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
