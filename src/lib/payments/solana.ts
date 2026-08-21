import { base58Decode } from "../base58";
import { RPC_COMMITMENT, USDC_MINT, solanaRpcUrl, usdToBaseUnits } from "./config";

/**
 * Verifies that a Solana transaction really paid us.
 *
 * Written against the transaction's token balance deltas rather than its
 * instructions. A transfer can arrive as `transfer`, `transferChecked`, through
 * a CPI, or bundled with other instructions; the balance delta on our account
 * is the same in every case and cannot be faked by instruction shape.
 */

export type PaymentFailure =
  | "invalid_signature"
  | "not_found"
  | "not_confirmed"
  | "failed_tx"
  | "wrong_token"
  | "wrong_destination"
  | "insufficient_amount"
  | "rpc_unavailable";

export type VerifyResult =
  | { ok: true; amountBaseUnits: bigint }
  | { ok: false; reason: PaymentFailure; message: string };

type TokenBalance = {
  accountIndex?: number;
  mint?: string;
  owner?: string;
  uiTokenAmount?: { amount?: string };
};

export type SolanaTransaction = {
  slot?: number;
  meta?: {
    err?: unknown;
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
} | null;

/** Injected so tests can drive the verifier with fixture transactions. */
export type TransactionFetcher = (signature: string) => Promise<SolanaTransaction>;

/** A Solana signature is 64 bytes of base58 — usually 87 or 88 characters. */
export function isSignatureShaped(signature: string): boolean {
  const decoded = base58Decode(signature.trim());
  return decoded !== null && decoded.length === 64;
}

function sumFor(balances: TokenBalance[] | undefined, wallet: string, mint: string): bigint {
  let total = 0n;
  for (const balance of balances ?? []) {
    if (balance.owner === wallet && balance.mint === mint) {
      total += BigInt(balance.uiTokenAmount?.amount ?? "0");
    }
  }
  return total;
}

function touchedWallet(balances: TokenBalance[] | undefined, wallet: string): boolean {
  return (balances ?? []).some((balance) => balance.owner === wallet);
}

export async function verifyPayment(params: {
  signature: string;
  expectedAmountUsd: number;
  wallet: string;
  fetchTransaction?: TransactionFetcher;
}): Promise<VerifyResult> {
  const signature = params.signature.trim();

  if (!isSignatureShaped(signature)) {
    return {
      ok: false,
      reason: "invalid_signature",
      message: "That does not look like a Solana transaction signature.",
    };
  }

  const fetchTransaction = params.fetchTransaction ?? defaultFetchTransaction;

  let transaction: SolanaTransaction;
  try {
    transaction = await fetchTransaction(signature);
  } catch {
    return {
      ok: false,
      reason: "rpc_unavailable",
      message: "Could not reach a Solana node to check this transaction. Try again in a moment.",
    };
  }

  // getTransaction only returns a transaction once it has reached the requested
  // commitment, so null covers both "does not exist" and "not confirmed yet".
  if (!transaction) {
    return {
      ok: false,
      reason: "not_confirmed",
      message:
        "That transaction is not confirmed yet, or does not exist. Wait a few seconds and try again.",
    };
  }

  if (!transaction.meta) {
    return {
      ok: false,
      reason: "not_confirmed",
      message: "That transaction has no confirmed result yet. Try again in a moment.",
    };
  }

  if (transaction.meta.err !== null && transaction.meta.err !== undefined) {
    return {
      ok: false,
      reason: "failed_tx",
      message: "That transaction failed on-chain, so nothing was transferred.",
    };
  }

  const { preTokenBalances, postTokenBalances } = transaction.meta;

  const received =
    sumFor(postTokenBalances, params.wallet, USDC_MINT) -
    sumFor(preTokenBalances, params.wallet, USDC_MINT);

  if (received <= 0n) {
    // Distinguish "paid the wrong token" from "paid someone else" so the person
    // who just spent money is told which mistake they made.
    const walletGotSomething =
      touchedWallet(postTokenBalances, params.wallet) ||
      touchedWallet(preTokenBalances, params.wallet);

    return walletGotSomething
      ? {
          ok: false,
          reason: "wrong_token",
          message:
            "That transaction moved a different token. Bids are paid in USDC on Solana — check you sent the real USDC mint.",
        }
      : {
          ok: false,
          reason: "wrong_destination",
          message: "That transaction did not send USDC to our payment wallet.",
        };
  }

  const required = usdToBaseUnits(params.expectedAmountUsd);
  if (received < required) {
    return {
      ok: false,
      reason: "insufficient_amount",
      message: `That transaction sent ${formatUsdc(received)} USDC but this bid needs ${formatUsdc(required)}.`,
    };
  }

  return { ok: true, amountBaseUnits: received };
}

export function formatUsdc(baseUnits: bigint): string {
  const whole = baseUnits / 1_000_000n;
  const fraction = (baseUnits % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

async function defaultFetchTransaction(signature: string): Promise<SolanaTransaction> {
  const response = await fetch(solanaRpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          encoding: "jsonParsed",
          commitment: RPC_COMMITMENT,
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`RPC responded ${response.status}`);
  const payload = (await response.json()) as { result?: SolanaTransaction; error?: unknown };
  if (payload.error) throw new Error("RPC returned an error");
  return payload.result ?? null;
}
