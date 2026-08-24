import { base58Decode } from "../base58";

/**
 * What the signature field accepts.
 *
 * A signature is never typed — it is copied off an explorer, and the button
 * that sits next to it there copies the *link*, not the signature. The first
 * person who ever paid pasted `https://solscan.io/tx/…` and was told it did not
 * look like a signature, which is true and useless: the signature was right
 * there in the URL we rejected.
 *
 * So the field takes either form. Only explorers we name are unwrapped, and the
 * part we pull out still has to be signature-shaped, so this widens what a user
 * may paste without widening what we will look up.
 */

/** Hosts whose `/tx/<signature>` path we will read a signature out of. */
const EXPLORER_HOSTS = new Set(["solscan.io", "solana.fm", "explorer.solana.com"]);

/** Shown whenever the field holds neither form. Named so the client and the API agree. */
export const SIGNATURE_INPUT_HELP =
  "Paste the transaction signature, or the Solscan link to it.";

/** A Solana signature is 64 bytes of base58 — usually 87 or 88 characters. */
export function isSignatureShaped(signature: string): boolean {
  const decoded = base58Decode(signature.trim());
  return decoded !== null && decoded.length === 64;
}

/**
 * Returns the bare signature in `input`, whether it was pasted bare or as an
 * explorer link. Null when it is neither — the caller turns that into
 * `SIGNATURE_INPUT_HELP` rather than spending an RPC call on it.
 */
export function parseSignatureInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (isSignatureShaped(raw)) return raw;
  return signatureFromExplorerUrl(raw);
}

function signatureFromExplorerUrl(raw: string): string | null {
  let url: URL;
  try {
    // Schemeless is how a URL arrives when it is copied out of the address bar
    // on some browsers, so it is read the same way `normalizeLink` reads one.
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  // Exact host, not suffix: `solscan.io.example.com` is somebody else's domain.
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!EXPLORER_HOSTS.has(host)) return null;

  // Query and hash are ignored on purpose — `?cluster=…` rides along on every
  // link these explorers hand out and says nothing about which transaction it is.
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "tx") return null;

  const signature = decodeURIComponent(segments[1]);
  return isSignatureShaped(signature) ? signature : null;
}
