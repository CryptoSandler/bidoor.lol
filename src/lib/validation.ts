import { checkAddress } from "./addresses";
import { getChain, isChainId, isKnownLaunchpad, type Chain } from "./chains";
import { BOARD } from "./config";
import { normalizeLink } from "./links";
import { minimumBidFor } from "./ranking";

/**
 * What a bidder actually supplies. Name, ticker, logo and socials are not here
 * on purpose: they are read from DexScreener (see dexscreener.ts) so that
 * paying for a rank never grants control over what the entry says.
 */
export type BidInput = {
  chainId: string;
  contract: string;
  launchpadUrl: string;
  amountUsd: number | string;
};

export type NormalizedBid = {
  chainId: Chain["id"];
  contract: string;
  contractKey: string;
  launchpadUrl: string;
  launchpadHost: string;
  /**
   * Whether the launchpad host is one we recognise for this chain. Purely a
   * display signal — an unrecognised launchpad is accepted, it just does not
   * earn the mark.
   */
  launchpadVerified: boolean;
  amountUsd: number;
  /** Params we removed from the launchpad link, so the UI can say so out loud. */
  strippedParams: string[];
};

export type FieldErrors = Partial<Record<keyof BidInput, string>>;

export type ValidationResult =
  | { ok: true; value: NormalizedBid }
  | { ok: false; errors: FieldErrors };

/** Everything the validator needs to know about the board's current state. */
export type ExistingEntry = { contractKey: string; totalUsd: number } | null;

export function contractKeyFor(chainId: string, contract: string): string | null {
  const chain = getChain(chainId);
  if (!chain) return null;
  const checked = checkAddress(chain.family, contract);
  if (!checked.ok) return null;
  // Scoped by chain: the same bytes can be a real contract on several EVM
  // chains, and those are different tokens.
  return `${chain.id}:${checked.canonical}`;
}

/**
 * Shape validation only — everything here is synchronous and runs identically
 * in the browser and on the server. Proving the token exists is a separate,
 * asynchronous step; this just makes sure it is worth asking.
 */
export function validateBid(input: BidInput, existing: ExistingEntry): ValidationResult {
  const errors: FieldErrors = {};
  const strippedParams: string[] = [];

  if (!isChainId(input.chainId) || !getChain(input.chainId)) {
    return { ok: false, errors: { chainId: "Pick a chain." } };
  }
  const chain = getChain(input.chainId)!;

  // --- Contract address, checked against the chain that was picked ---------
  const address = checkAddress(chain.family, input.contract ?? "");
  if (!address.ok) {
    errors.contract = `${address.reason} You selected ${chain.name}.`;
  }

  // --- Launchpad link -----------------------------------------------------
  // Required, and held to the same link hygiene as everything else, but NOT
  // checked against a list of approved domains. Whether the token exists is
  // DexScreener's call; this link is context, and a launchpad we have not heard
  // of is not a reason to refuse a real token.
  let launchpadUrl = "";
  let launchpadHost = "";
  let launchpadVerified = false;
  const launchpad = normalizeLink(input.launchpadUrl ?? "", "launchpad");
  if (!launchpad.ok) {
    errors.launchpadUrl = launchpad.reason;
  } else {
    launchpadUrl = launchpad.url;
    launchpadHost = launchpad.host;
    launchpadVerified = isKnownLaunchpad(chain, launchpad.host);
    strippedParams.push(...launchpad.strippedParams);
  }

  // --- Amount -------------------------------------------------------------
  const amountUsd =
    typeof input.amountUsd === "string" ? Number(input.amountUsd.trim()) : input.amountUsd;

  const minimum = minimumBidFor(existing ? existing.totalUsd : null);

  if (!Number.isFinite(amountUsd)) {
    errors.amountUsd = "Enter an amount.";
  } else if (!Number.isInteger(amountUsd)) {
    errors.amountUsd = "Bids are whole dollars.";
  } else if (amountUsd < minimum) {
    errors.amountUsd = existing
      ? `This token is already listed — top-ups start at $${minimum}.`
      : `New listings start at $${minimum}.`;
  } else if (amountUsd > BOARD.maxBidUsd) {
    errors.amountUsd = `The most you can send in one go is $${BOARD.maxBidUsd.toLocaleString("en-US")}.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      chainId: chain.id,
      contract: address.ok ? address.display : "",
      contractKey: `${chain.id}:${address.ok ? address.canonical : ""}`,
      launchpadUrl,
      launchpadHost,
      launchpadVerified,
      amountUsd: amountUsd as number,
      strippedParams: [...new Set(strippedParams)],
    },
  };
}
