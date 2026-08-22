import { base58Decode } from "../base58";
import {
  BLOCKTIME_SKEW_SECONDS,
  RPC_BACKOFF_MAX_MS,
  RPC_BACKOFF_MS,
  RPC_COMMITMENT,
  RPC_MAX_ATTEMPTS,
  USDC_MINT,
  solanaRpcUrls,
} from "./config";

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
  | "overpaid"
  | "outside_bid_window"
  | "no_block_time"
  | "rpc_unavailable";

export type VerifyResult =
  | { ok: true; amountBaseUnits: bigint }
  | {
      ok: false;
      reason: PaymentFailure;
      message: string;
      /**
       * What actually arrived, when a real transfer reached our wallet but did
       * not match. The caller needs this to file the payment for support
       * instead of letting somebody's money vanish.
       */
      receivedBaseUnits?: bigint;
      /**
       * Who the transfer came from, when we can tell. An operator reuniting a
       * stray payment with a bid is otherwise trusting a bid id supplied by
       * whoever pasted the signature — which is exactly how you get talked into
       * paying an attacker's rank with a stranger's money.
       */
      sender?: SenderInfo;
    };

export type SenderInfo = {
  /** Fee payer: the first signer on the transaction. */
  feePayer: string | null;
  /**
   * Wallets whose USDC balance went DOWN in this transaction — whoever actually
   * funded it. Usually one; more than one means the operator should look
   * harder, not less.
   */
  debited: { owner: string; amountBaseUnits: string }[];
};

type TokenBalance = {
  accountIndex?: number;
  mint?: string;
  owner?: string;
  uiTokenAmount?: { amount?: string };
};

/** Enough of the parsed transaction to name who signed and paid the fee. */
type TransactionMessage = {
  accountKeys?: { pubkey?: string; signer?: boolean }[];
};

export type SolanaTransaction = {
  slot?: number;
  /** Unix seconds. Absent on very old transactions and on some light nodes. */
  blockTime?: number | null;
  transaction?: { message?: TransactionMessage };
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

/**
 * Works out who paid, from the same balance deltas the amount comes from.
 *
 * Deliberately reports every debited owner rather than picking one: a transfer
 * routed through an aggregator has more than one, and quietly showing the first
 * would be worse than showing all of them.
 */
function senderOf(transaction: NonNullable<SolanaTransaction>, wallet: string): SenderInfo {
  const pre = transaction.meta?.preTokenBalances ?? [];
  const post = transaction.meta?.postTokenBalances ?? [];

  const owners = new Set<string>();
  for (const balance of [...pre, ...post]) {
    if (balance.owner && balance.owner !== wallet && balance.mint === USDC_MINT) {
      owners.add(balance.owner);
    }
  }

  const debited: SenderInfo["debited"] = [];
  for (const owner of owners) {
    const delta = sumFor(post, owner, USDC_MINT) - sumFor(pre, owner, USDC_MINT);
    if (delta < 0n) debited.push({ owner, amountBaseUnits: (-delta).toString() });
  }

  const feePayer =
    transaction.transaction?.message?.accountKeys?.find((key) => key.signer)?.pubkey ?? null;

  return { feePayer, debited };
}

export async function verifyPayment(params: {
  signature: string;
  /**
   * The exact amount this bid must be paid with, in USDC base units. Attribution
   * is by amount, so this is matched exactly rather than as a minimum.
   */
  expectedBaseUnits: bigint;
  wallet: string;
  /**
   * The bid's own window, as epoch milliseconds. The transaction must have
   * landed inside it.
   *
   * Without this, a payment is a bearer instrument: amounts are only unique
   * among live bids, so they are recycled, and any unspent transfer ever made
   * to our wallet could be claimed by whoever pasted its signature first. Tying
   * the transaction to the window means a transfer that predates the bid cannot
   * pay for it, however well the amount matches.
   */
  createdAtMs: number;
  expiresAtMs: number;
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

  // --- The transaction must belong to this bid's lifetime -----------------
  const blockTime = transaction.blockTime;
  if (typeof blockTime !== "number" || !Number.isFinite(blockTime)) {
    // Refusing to guess: without a timestamp we cannot tell a fresh payment
    // from one lifted off the chain, and guessing in the caller's favour is
    // exactly the hole this check exists to close.
    return {
      ok: false,
      reason: "no_block_time",
      message:
        "That transaction has no confirmed block time yet, so it cannot be matched to this bid. Try again in a moment.",
    };
  }

  const skewMs = BLOCKTIME_SKEW_SECONDS * 1000;
  const blockTimeMs = blockTime * 1000;
  if (blockTimeMs < params.createdAtMs - skewMs || blockTimeMs > params.expiresAtMs + skewMs) {
    return {
      ok: false,
      reason: "outside_bid_window",
      message:
        "That transaction was not made during this bid. Pay for a bid after starting it — a transfer from before the bid existed cannot be used to claim it.",
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

  // Exact, not "at least". The amount IS the attribution: a payment for
  // $50.0041 belongs to exactly one bid, and accepting $50.0042 for it would
  // throw away the only thing tying this transfer to this bidder.
  const required = params.expectedBaseUnits;
  if (received !== required) {
    const short = received < required;
    return {
      ok: false,
      reason: short ? "insufficient_amount" : "overpaid",
      message:
        `That transaction sent exactly ${formatUsdc(received)} USDC, but this bid must be paid with ` +
        `exactly ${formatUsdc(required)} — the amount is how we match a payment to a bid. ` +
        `Your ${formatUsdc(received)} is recorded against this bid and is not lost, but this ` +
        `transaction is now spent and cannot be submitted again.`,
      receivedBaseUnits: received,
      sender: senderOf(transaction, params.wallet),
    };
  }

  return { ok: true, amountBaseUnits: received };
}

export function formatUsdc(baseUnits: bigint): string {
  const whole = baseUnits / 1_000_000n;
  const fraction = (baseUnits % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A confirmed transaction that genuinely does not exist and a node that is
 * rate-limiting us both look like "no result". Retrying across endpoints with
 * backoff is what keeps the second case from being reported to a paying user as
 * the first.
 */
async function defaultFetchTransaction(signature: string): Promise<SolanaTransaction> {
  const endpoints = solanaRpcUrls();
  let lastError: unknown = new Error("No RPC endpoint configured");

  for (let attempt = 0; attempt < RPC_MAX_ATTEMPTS; attempt++) {
    // Rotate endpoints so a single bad node does not eat every attempt.
    const endpoint = endpoints[attempt % endpoints.length];
    try {
      return await callGetTransaction(endpoint, signature);
    } catch (error) {
      lastError = error;
      if (attempt < RPC_MAX_ATTEMPTS - 1) {
        // Capped so a retry cannot hold a request open for long. Attempts are
        // sequential, so they never multiply concurrent connections; the cap is
        // about how long one request can occupy a worker.
        await sleep(Math.min(RPC_BACKOFF_MS * 2 ** attempt, RPC_BACKOFF_MAX_MS));
      }
    }
  }

  throw lastError;
}

async function callGetTransaction(
  endpoint: string,
  signature: string,
): Promise<SolanaTransaction> {
  const response = await fetch(endpoint, {
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
