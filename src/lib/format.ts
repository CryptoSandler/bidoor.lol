/** Whole-dollar money. The board never shows cents. */
export function usd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** Compact money for tight mobile rows: $12.6k, $1.2M. */
export function usdCompact(amount: number): string {
  if (amount < 10_000) return usd(amount);
  if (amount < 1_000_000) return `$${(amount / 1000).toFixed(amount < 100_000 ? 1 : 0)}k`;
  return `$${(amount / 1_000_000).toFixed(1)}M`;
}

export function compactCount(value: number): string {
  if (value < 1000) return `${value}`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

/**
 * Relative time, rendered on the server so the markup is stable. Deliberately
 * coarse — the board is about money, not timestamps.
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * The same age, spelled out: "4 minutes ago" rather than "4m ago".
 *
 * The compact form is right in a row, where it sits beside a chain badge and a
 * click count and every character is competing. The activity rail has one line
 * per chip and reads as a sentence, so it gets the long form.
 */
export function timeAgoLong(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";

  const units: [number, string][] = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
    [30, "month"],
  ];

  let value = seconds;
  let name = "second";
  for (const [size, label] of units) {
    if (value < size) break;
    value = Math.floor(value / size);
    name = label;
  }
  return `${value} ${name}${value === 1 ? "" : "s"} ago`;
}

/**
 * `9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump` -> `9cRC…pump`.
 *
 * Enough at each end to recognise an address you already know, which is all a
 * shortened one can honestly do. Anything that has to be checked character by
 * character gets copied instead.
 */
export function truncateAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}\u2026${address.slice(-tail)}`;
}
