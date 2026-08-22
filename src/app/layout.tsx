import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
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
  title: "BIDOOR.LOL — pay-to-rank token leaderboard",
  description: DESCRIPTION,
  openGraph: {
    title: "BIDOOR.LOL — pay-to-rank token leaderboard",
    description: DESCRIPTION,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "BIDOOR.LOL", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Applies the pinned theme before the first paint. Doing this in a
            component would flash the wrong theme on every load, and the flash
            is worst in exactly the case somebody chose a theme to avoid. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('bd-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-dvh bg-bg text-text">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="shell flex items-center justify-between py-3">
            <Link href="/" aria-label="BIDOOR.LOL — leaderboard" className="flex items-center">
              <Wordmark height="1.25rem" />
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted sm:gap-5">
              {/* Dropped on the smallest screens: the wordmark beside it already
                  goes to the board, and with the .LOL suffix the two of them
                  touch at 375px. Redundant link out, breathing room in. */}
              <Link href="/" className="hidden transition-colors hover:text-text sm:inline">
                Leaderboard
              </Link>
              <Link href="/rules" className="transition-colors hover:text-text">
                Rules
              </Link>
              <ThemeToggle />
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
              BIDOOR.LOL ranks tokens by how much has been paid for the spot. Nothing on this board is
              an endorsement, an audit, or financial advice. Token names, logos and links are read
              from DexScreener. Do your own research before you touch any token listed here.
            </p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link href="/rules" className="hover:text-muted">
                Rules
              </Link>
              <span aria-hidden>·</span>
              <span>Bids are paid in USDC on Solana and are final and non-refundable.</span>
              <span aria-hidden>·</span>
              {/* Neutral like every other link down here: attribution is not an
                  action, so it does not get the accent. */}
              <a
                href="https://x.com/CryptoSandlerr"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-muted hover:underline"
              >
                Built by @CryptoSandlerr
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
