"use client";

import { useEffect, useState } from "react";
import { dexscreenerTokenUrl } from "@/lib/chains";
import { truncateAddress } from "@/lib/format";
import type { RankedEntry } from "@/lib/types";

/**
 * The contract address and the token's links, inline on the row's second line.
 *
 * Everything here is already on the entry, written when the bid settled, so a
 * board of fifty rows showing all of it costs no requests. Nothing is behind a
 * disclosure: the address is the one thing a bidder came to copy, and a link
 * nobody can see is a link nobody clicks.
 */

// One step up from the 12px they were at: at that size the candle and the
// globe were the same grey smudge.
const ICON = "h-4 w-4 shrink-0";

function DexScreenerIcon() {
  // A candle: two wicks and a body.
  return (
    <svg viewBox="0 0 16 16" className={ICON} aria-hidden focusable="false">
      <path
        d="M8 1.2v2.4M8 12.4v2.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="4.6" y="3.6" width="6.8" height="8.8" rx="1.4" fill="currentColor" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" className={ICON} aria-hidden focusable="false">
      <path
        d="M12.2 1.5h2.3L9.5 7.2l5.9 7.3h-4.6L7.2 10l-4.1 4.5H.8l5.4-6.1L.5 1.5h4.7l3.2 4.2zm-.8 11.6h1.3L4.7 2.8H3.3z"
        fill="currentColor"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 16 16" className={ICON} aria-hidden focusable="false">
      <path
        d="M14.6 2.3 1.5 7.3c-.6.2-.6.9 0 1.1l3.3 1 1.3 3.9c.2.5.8.6 1.1.2l1.8-1.8 3.2 2.4c.4.3 1 .1 1.1-.4l2.1-10c.1-.6-.4-1-.8-.8zM6.2 9.4l6-3.7-4.7 4.4-.2 2.3z"
        fill="currentColor"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 16 16" className={ICON} aria-hidden focusable="false">
      <path
        d="M13.2 3.3A12 12 0 0 0 10.4 2l-.2.4a9 9 0 0 0-4.4 0L5.6 2a12 12 0 0 0-2.8 1.3C1 6 .6 8.6.8 11.2A12 12 0 0 0 4.4 13l.7-1.1a8 8 0 0 1-1.2-.6l.3-.2a8.6 8.6 0 0 0 7.6 0l.3.2a8 8 0 0 1-1.2.6l.7 1.1a12 12 0 0 0 3.6-1.8c.3-3-.4-5.6-2-7.9zM5.7 9.6c-.7 0-1.3-.7-1.3-1.5s.6-1.5 1.3-1.5 1.3.7 1.3 1.5-.6 1.5-1.3 1.5zm4.6 0c-.7 0-1.3-.7-1.3-1.5s.6-1.5 1.3-1.5 1.3.7 1.3 1.5-.6 1.5-1.3 1.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" className={ICON} aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="8" cy="8" r="6.3" />
        <ellipse cx="8" cy="8" rx="2.6" ry="6.3" />
        <path d="M1.9 6h12.2M1.9 10h12.2" />
      </g>
    </svg>
  );
}

function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={label}
      aria-label={label}
      className="-my-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:text-text"
    >
      {children}
    </a>
  );
}

/** The row's own copy control: an icon, because the row has no width to spare. */
function CopyAddress({ value, name }: { value: string; name: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard access can be denied; the address is on screen either way.
          setCopied(false);
        }
      }}
      title={copied ? "Copied" : `Copy the ${name} contract address`}
      aria-label={copied ? "Copied" : `Copy the ${name} contract address`}
      className="-my-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:text-text"
    >
      {copied ? (
        <svg viewBox="0 0 16 16" className={ICON} aria-hidden focusable="false">
          <path
            d="M3 8.5 6.2 12 13 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className={ICON} aria-hidden focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5.2" y="5.2" width="8.3" height="8.3" rx="1.6" />
            <path d="M10.8 5.2V4a1.6 1.6 0 0 0-1.6-1.6H4a1.6 1.6 0 0 0-1.6 1.6v5.2A1.6 1.6 0 0 0 4 10.8h1.2" />
          </g>
        </svg>
      )}
    </button>
  );
}

function ShareIcon() {
  // An arrow leaving a box: the same idea as every share glyph, drawn to sit
  // with the others rather than borrowed from a platform.
  return (
    <svg viewBox="0 0 16 16" className={ICON} aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.8v8.4M5 4.8 8 1.8l3 3" />
        <path d="M3.2 9.2v3.4a1.6 1.6 0 0 0 1.6 1.6h6.4a1.6 1.6 0 0 0 1.6-1.6V9.2" />
      </g>
    </svg>
  );
}

export function RowMeta({ entry, shareHref }: { entry: RankedEntry; shareHref: string }) {
  const dexscreener = dexscreenerTokenUrl(entry.chainId, entry.contract);

  return (
    <>
      <span className="num truncate text-2xs text-muted" title={entry.contract}>
        {truncateAddress(entry.contract)}
      </span>
      <CopyAddress value={entry.contract} name={entry.name} />

      {dexscreener && (
        <IconLink href={dexscreener} label={`${entry.name} on DexScreener`}>
          <DexScreenerIcon />
        </IconLink>
      )}

      {/* Kept out of the group that hides on phones: sharing a rank from the
          phone you are already holding is the whole point. */}
      <IconLink href={shareHref} label={`Share ${entry.name} at #${entry.rank}`}>
        <ShareIcon />
      </IconLink>

      {/* The socials are the first thing to go when the row runs out of width:
          the address and the chart are what a bidder is checking. */}
      <span className="hidden items-center sm:inline-flex">
        {entry.links.website && (
          <IconLink href={entry.links.website} label={`${entry.name} website`}>
            <GlobeIcon />
          </IconLink>
        )}
        {entry.links.x && (
          <IconLink href={entry.links.x} label={`${entry.name} on X`}>
            <XIcon />
          </IconLink>
        )}
        {entry.links.telegram && (
          <IconLink href={entry.links.telegram} label={`${entry.name} on Telegram`}>
            <TelegramIcon />
          </IconLink>
        )}
        {entry.links.discord && (
          <IconLink href={entry.links.discord} label={`${entry.name} on Discord`}>
            <DiscordIcon />
          </IconLink>
        )}
      </span>
    </>
  );
}
