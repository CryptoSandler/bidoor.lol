import { checkAddress } from "./addresses";
import { getChain, isChainId, type Chain } from "./chains";
import { BOARD, MAX_NAME_LENGTH, MAX_TICKER_LENGTH } from "./config";
import { hostMatches, normalizeLink, normalizeXHandle } from "./links";
import { minimumBidFor } from "./ranking";
import type { EntryLinks } from "./types";

export type BidInput = {
  chainId: string;
  contract: string;
  name: string;
  ticker: string;
  logoUrl?: string;
  launchpadUrl: string;
  website?: string;
  x?: string;
  telegram?: string;
  discord?: string;
  amountUsd: number | string;
};

export type NormalizedBid = {
  chainId: Chain["id"];
  contract: string;
  contractKey: string;
  name: string;
  ticker: string;
  logoUrl?: string;
  launchpadUrl: string;
  launchpadHost: string;
  links: EntryLinks;
  amountUsd: number;
  /** Params we removed from submitted links, so the UI can say so out loud. */
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

export function validateBid(input: BidInput, existing: ExistingEntry): ValidationResult {
  const errors: FieldErrors = {};
  const strippedParams: string[] = [];

  if (!isChainId(input.chainId)) {
    return { ok: false, errors: { chainId: "Pick a chain." } };
  }
  const chain = getChain(input.chainId)!;

  // --- Contract address, checked against the chain that was picked ---------
  const address = checkAddress(chain.family, input.contract ?? "");
  if (!address.ok) {
    errors.contract = `${address.reason} You selected ${chain.name}.`;
  }

  // --- Name and ticker ----------------------------------------------------
  const name = (input.name ?? "").trim();
  if (!name) errors.name = "Enter the token name.";
  else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  const ticker = (input.ticker ?? "").trim().replace(/^\$/, "").toUpperCase();
  if (!ticker) errors.ticker = "Enter the ticker.";
  else if (!/^[A-Z0-9]{1,12}$/.test(ticker)) {
    errors.ticker = `Tickers are letters and numbers, up to ${MAX_TICKER_LENGTH} characters.`;
  }

  // --- Launchpad link: must be a real launchpad for THIS chain -------------
  let launchpadUrl = "";
  let launchpadHost = "";
  const launchpad = normalizeLink(input.launchpadUrl ?? "", "launchpad");
  if (!launchpad.ok) {
    errors.launchpadUrl = launchpad.reason;
  } else if (!chain.launchpads.some((allowed) => hostMatches(launchpad.host, allowed))) {
    errors.launchpadUrl = `${launchpad.host} is not a ${chain.name} launchpad. Accepted for ${chain.name}: ${chain.launchpads.join(", ")}.`;
  } else {
    launchpadUrl = launchpad.url;
    launchpadHost = launchpad.host;
    strippedParams.push(...launchpad.strippedParams);
  }

  // --- Optional links -----------------------------------------------------
  const links: EntryLinks = {};

  if (input.website?.trim()) {
    const website = normalizeLink(input.website, "website");
    if (!website.ok) errors.website = website.reason;
    else {
      links.website = website.url;
      strippedParams.push(...website.strippedParams);
    }
  }

  if (input.x?.trim()) {
    const x = normalizeXHandle(input.x);
    if (!x.ok) errors.x = x.reason;
    else {
      links.x = x.url;
      strippedParams.push(...x.strippedParams);
    }
  }

  if (input.telegram?.trim()) {
    const telegram = normalizeLink(input.telegram, "telegram");
    if (!telegram.ok) errors.telegram = telegram.reason;
    else if (!hostMatches(telegram.host, "t.me")) {
      errors.telegram = "Use a t.me link for Telegram.";
    } else {
      links.telegram = telegram.url;
      strippedParams.push(...telegram.strippedParams);
    }
  }

  if (input.discord?.trim()) {
    const discord = normalizeLink(input.discord, "discord");
    if (!discord.ok) errors.discord = discord.reason;
    else if (!hostMatches(discord.host, "discord.gg") && !hostMatches(discord.host, "discord.com")) {
      errors.discord = "Use a discord.gg invite link.";
    } else {
      links.discord = discord.url;
      strippedParams.push(...discord.strippedParams);
    }
  }

  let logoUrl: string | undefined;
  if (input.logoUrl?.trim()) {
    const logo = normalizeLink(input.logoUrl, "website");
    if (!logo.ok) errors.logoUrl = logo.reason;
    else logoUrl = logo.url;
  }

  // --- Amount -------------------------------------------------------------
  const amountUsd = typeof input.amountUsd === "string"
    ? Number(input.amountUsd.trim())
    : input.amountUsd;

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
      name,
      ticker,
      logoUrl,
      launchpadUrl,
      launchpadHost,
      links,
      amountUsd: amountUsd as number,
      strippedParams: [...new Set(strippedParams)],
    },
  };
}
