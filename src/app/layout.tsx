import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Both faces are free: DM Sans and Geist Mono ship from Google Fonts.
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500", "700"],
});

const DESCRIPTION =
  "One board, every chain. The token that has paid the most sits at #1. Rank is the bid, nothing else.";

export const metadata: Metadata = {
  // Needed for the opengraph image to resolve to an absolute URL.
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "BIDOOR — pay-to-rank token leaderboard",
  description: DESCRIPTION,
  openGraph: {
    title: "BIDOOR — pay-to-rank token leaderboard",
    description: DESCRIPTION,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "BIDOOR", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-bg text-text">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="shell flex items-center justify-between py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight">
                BID<span className="text-accent">OOR</span>
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted sm:gap-5">
              <Link href="/" className="transition-colors hover:text-text">
                Leaderboard
              </Link>
              <Link href="/rules" className="transition-colors hover:text-text">
                Rules
              </Link>
              <Link
                href="/bid"
                className="rounded-pill bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
              >
                Bid
              </Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-10 border-t border-line py-6">
          <div className="shell text-xs leading-relaxed text-faint">
            <p className="max-w-xl">
              BIDOOR ranks tokens by how much has been paid for the spot. Nothing on this board is
              an endorsement, an audit, or financial advice. Token names, logos and links are read
              from DexScreener. Do your own research before you touch any token listed here.
            </p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link href="/rules" className="hover:text-muted">
                Rules
              </Link>
              <span aria-hidden>·</span>
              <span>Bids are paid in USDC on Solana and are final and non-refundable.</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
