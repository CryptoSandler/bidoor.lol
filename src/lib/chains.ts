import type { AddressFamily } from "./addresses";

/**
 * "robinhood" stays in the union while the chain is not offered: entries and
 * bids may already reference it, and reinstating it should be a matter of
 * putting its entry back in CHAINS rather than migrating data.
 */
export type ChainId =
  | "solana"
  | "bnb"
  | "robinhood"
  | "base"
  | "ethereum"
  | "ton"
  | "tron"
  | "hyperliquid";

export type Chain = {
  id: ChainId;
  name: string;
  /** Short form used in the row badge, where space is tight. */
  short: string;
  family: AddressFamily;
  /**
   * DexScreener's own identifier for this chain, which is not always what you
   * would guess — Hyperliquid is "hyperevm" and BNB Chain is "bsc". Getting
   * this wrong makes every lookup on the chain silently return nothing.
   */
  dexscreenerId: string;
  /** Badge colours, tuned for the dark surface. */
  tint: string;
  ink: string;
  /**
   * Hosts we recognise as launchpads on this chain.
   *
   * NOT a gate. DexScreener decides whether a token can be listed; this list
   * only decides whether the entry earns a "verified launchpad" mark. A token
   * that launched somewhere we have never heard of is still a real token, and
   * refusing it taught us nothing — it just kept real listings off the board.
   * Adding a domain here is one line, and costs nothing if we are late.
   *
   * Matching is on the registrable host and covers subdomains.
   */
  launchpads: string[];
  /** Explains the expected format, shown under the input. */
  addressHint: string;
  /** A shape-of-the-thing sample, shown inside the input. */
  addressPlaceholder: string;
};

export const CHAINS: Chain[] = [
  {
    id: "solana",
    dexscreenerId: "solana",
    name: "Solana",
    short: "SOL",
    family: "solana",
    tint: "#1B2A2E",
    ink: "#5FE9C4",
    launchpads: ["pump.fun", "letsbonk.fun", "bonk.fun", "believe.app", "boop.fun", "moonshot.money", "daos.fun", "bags.fm"],
    addressHint: "Base58 mint address, 32–44 characters.",
    addressPlaceholder: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  },
  {
    id: "bnb",
    dexscreenerId: "bsc",
    name: "BNB Chain",
    short: "BNB",
    family: "evm",
    tint: "#2C2712",
    ink: "#F0B90B",
    launchpads: ["four.meme", "flap.sh", "bonk.fun"],
    addressHint: "0x plus 40 hex characters.",
    addressPlaceholder: "0x0000000000000000000000000000000000000000",
  },
  {
    id: "robinhood",
    dexscreenerId: "robinhood",
    name: "Robinhood Chain",
    short: "RHC",
    family: "evm",
    tint: "#14261B",
    ink: "#7BE38B",
    // An Arbitrum L2 with no native token — gas is paid in ETH — so addresses
    // are ordinary EVM addresses.
    //
    // hood.fun is verified: a live memecoin launchpad on this chain. "RobinPad"
    // is deliberately NOT here: the name is used by several unrelated products
    // and none has a verifiable official domain (robinpad.xyz self-describes as
    // demo software with zero launches; rpad.fun has nothing to verify against;
    // robinpad.fi returns HTTP 402). Since this list no longer gates anything,
    // leaving it out only means those listings show without the verified mark.
    launchpads: ["hood.fun"],
    addressHint: "0x plus 40 hex characters.",
    addressPlaceholder: "0x0000000000000000000000000000000000000000",
  },
  {
    id: "base",
    dexscreenerId: "base",
    name: "Base",
    short: "BASE",
    family: "evm",
    tint: "#161E38",
    ink: "#6E8DFB",
    launchpads: ["clanker.world", "zora.co", "flaunch.gg", "virtuals.io", "bankr.bot"],
    addressHint: "0x plus 40 hex characters.",
    addressPlaceholder: "0x0000000000000000000000000000000000000000",
  },
  {
    id: "ethereum",
    dexscreenerId: "ethereum",
    name: "Ethereum",
    short: "ETH",
    family: "evm",
    tint: "#1D1C2E",
    ink: "#A2A0F0",
    launchpads: ["zora.co", "virtuals.io", "fjordfoundry.com", "echo.xyz"],
    addressHint: "0x plus 40 hex characters.",
    addressPlaceholder: "0x0000000000000000000000000000000000000000",
  },
  {
    id: "ton",
    dexscreenerId: "ton",
    name: "TON",
    short: "TON",
    family: "ton",
    tint: "#11242F",
    ink: "#54B8E8",
    launchpads: ["gaspump.tg", "tonup.io", "blum.io", "ton.diamonds"],
    addressHint: "User-friendly EQ…/UQ… form, or raw 0:<64 hex>.",
    addressPlaceholder: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  },
  {
    id: "tron",
    dexscreenerId: "tron",
    name: "TRON",
    short: "TRX",
    family: "tron",
    tint: "#2C1618",
    ink: "#F06A6A",
    launchpads: ["sunpump.meme", "sun.io"],
    addressHint: "Starts with T, 34 characters.",
    addressPlaceholder: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  },
  {
    id: "hyperliquid",
    dexscreenerId: "hyperevm",
    name: "Hyperliquid",
    short: "HYPE",
    family: "evm",
    tint: "#122A28",
    ink: "#63E0CE",
    launchpads: ["hypurr.fun", "liquidlaunch.app", "hyperliquid.xyz"],
    addressHint: "0x plus 40 hex characters (HyperEVM).",
    addressPlaceholder: "0x0000000000000000000000000000000000000000",
  },
];

const BY_ID = new Map(CHAINS.map((chain) => [chain.id, chain]));

export function getChain(id: string): Chain | undefined {
  return BY_ID.get(id as ChainId);
}

export function isChainId(value: string): value is ChainId {
  return BY_ID.has(value as ChainId);
}

/** True when a host is a launchpad we recognise on this chain. */
export function isKnownLaunchpad(chain: Chain, host: string): boolean {
  return chain.launchpads.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}
