"use client";

import { useSyncExternalStore } from "react";

/**
 * Two states, not three, because data-theme already carries the meaning: with
 * no attribute the operating system decides, and one flick pins the opposite of
 * whatever you are looking at. A separate "system" position would be a third
 * thing to explain for a preference you can restore by clearing the site.
 *
 * The choice lives in localStorage and is applied by an inline script in the
 * document head, before first paint — see layout.tsx. Doing it here instead
 * would flash the wrong theme on every load, and the crossfade below is
 * deliberately kept out of that path: it animates a change the reader asked
 * for, never the first paint.
 */
export const THEME_KEY = "bd-theme";

/** Fired on our own toggle: the document is the store, and it has no event. */
const THEME_EVENT = "bd-theme-change";

function effectiveTheme(): "light" | "dark" {
  const pinned = document.documentElement.dataset.theme;
  if (pinned === "light" || pinned === "dark") return pinned;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

export function ThemeToggle() {
  // The theme lives on the document, not in React, so it is read as the
  // external store it is. The server snapshot is null, which renders the track
  // with the knob parked: the server cannot know which side is right, and
  // guessing produces a hydration mismatch on every load.
  const theme = useSyncExternalStore(subscribe, effectiveTheme, () => null);
  const isDark = theme === "dark";

  function apply() {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode and blocked storage are fine: the theme still switches for
      // this page, it just will not be remembered.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  function toggle() {
    // A crossfade of the whole document, which is what a theme change is. Where
    // startViewTransition does not exist the branch below just applies the
    // change, so the degraded path is the old instant swap and needs no
    // fallback of its own. Respecting a reduced-motion preference is not
    // optional: this animates the entire page.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !document.startViewTransition) {
      apply();
      return;
    }
    document.startViewTransition(() => apply());
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggle}
      aria-label="Dark theme"
      title={isDark ? "Switch to the light theme" : "Switch to the dark theme"}
      className="relative inline-flex h-8 w-[3.25rem] shrink-0 items-center rounded-pill border border-line-strong px-1 text-muted transition-colors hover:text-text"
    >
      {/* Both icons sit on the track and stay put; the knob is what moves. The
          one the knob is not covering is the state you are in. */}
      <span className="pointer-events-none flex w-full items-center justify-between">
        <SunIcon />
        <MoonIcon />
      </span>

      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-pill bg-surface-2 shadow-card transition-[left] duration-200 ease-out ${
          // Neutral, never slime: the header spends its accent on the Bid
          // button, and a second patch of it here would compete for the one
          // thing on this bar meant to be clicked.
          theme === null ? "left-1 opacity-0" : isDark ? "left-[calc(100%-1.75rem)]" : "left-1"
        }`}
      />
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="4.4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden focusable="false">
      <path d="M20.2 14.6A8.6 8.6 0 1 1 9.4 3.8a6.9 6.9 0 0 0 10.8 10.8Z" fill="currentColor" />
    </svg>
  );
}
