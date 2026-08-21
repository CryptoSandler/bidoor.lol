import type { AddressFamily } from "./addresses";

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
  /** Badge colours, tuned for the dark surface. */
  tint: string;
  ink: string;
  /**
   * Hosts that count as an official launchpad for this chain. A submission is
   * rejected when the launchpad link does not sit on one of these — that is the
   * cheapest signal we have that the token really launched where it claims.
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
    name: "Robinhood Chain",
    short: "RHC",
    family: "evm",
    tint: "#14261B",
    ink: "#7BE38B",
    // Provisional: this ecosystem is new and its launchpad set is not settled.
    // Treat as an ops-editable config value, not a product truth.
    launchpads: ["robinhood.com"],
    addressHint: "0x plus 40 hex characters.",
    addressPlaceholder: "0x0000000000000000000000000000000000000000",
  },
  {
    id: "base",
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
