import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIDTAPE — pay-to-rank token leaderboard",
  description:
    "One board, every chain. The token that has paid the most sits at #1. Rank is the bid, nothing else.",
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg text-text antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/85 px-3 py-2.5 backdrop-blur-md sm:px-4">
            <Link href="/" className="flex items-baseline gap-1.5">
              <span className="num text-base font-bold tracking-tight sm:text-lg">BIDTAPE</span>
              <span className="hidden text-[11px] text-muted-2 sm:inline">pay-to-rank</span>
            </Link>
            <nav className="flex items-center gap-3 text-xs text-muted sm:gap-4 sm:text-sm">
              <Link href="/rules" className="transition-colors hover:text-text">
                Rules
              </Link>
              <Link
                href="/bid"
                className="rounded-[3px] bg-accent px-2.5 py-1 text-xs font-semibold text-black transition-opacity hover:opacity-90 sm:px-3 sm:py-1.5"
              >
                Bid
              </Link>
            </nav>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-line px-3 py-5 text-[11px] leading-relaxed text-muted-2 sm:px-4">
            <p>
              BIDTAPE ranks tokens by how much has been paid for the spot. Nothing on this board is
              an endorsement, an audit, or financial advice. Do your own research before you touch
              any token listed here.
            </p>
            <p className="mt-2 flex gap-3">
              <Link href="/rules" className="hover:text-muted">
                Rules
              </Link>
              <span className="text-line-bright">·</span>
              <span>Demo build — mock data, no payments.</span>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
