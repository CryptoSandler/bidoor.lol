"use client";

import { useEffect, useState } from "react";

/**
 * Two states, not three, because data-theme already carries the meaning: with
 * no attribute the operating system decides, and one click pins the opposite of
 * whatever you are looking at. A separate "system" position would be a third
 * thing to explain for a preference you can restore by clearing the site.
 *
 * The choice lives in localStorage and is applied by an inline script in the
 * document head, before first paint — see layout.tsx. Doing it here instead
 * would flash the wrong theme on every load.
 */
export const THEME_KEY = "bd-theme";

function effectiveTheme(): "light" | "dark" {
  const pinned = document.documentElement.dataset.theme;
  if (pinned === "light" || pinned === "dark") return pinned;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  // Rendered empty until mounted: the server cannot know which icon is right,
  // and guessing produces a hydration mismatch on every load.
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => setTheme(effectiveTheme()), []);

  function toggle() {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode and blocked storage are fine: the theme still switches for
      // this page, it just will not be remembered.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:text-text"
    >
      {theme === null ? (
        <span className="block h-4 w-4" aria-hidden />
      ) : theme === "dark" ? (
        // Showing the sun means "this click gives you light".
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden focusable="false">
          <circle cx="12" cy="12" r="4.4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden focusable="false">
          <path
            d="M20.2 14.6A8.6 8.6 0 1 1 9.4 3.8a6.9 6.9 0 0 0 10.8 10.8Z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}
