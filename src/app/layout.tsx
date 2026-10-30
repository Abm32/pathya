import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Noto_Sans_Malayalam } from "next/font/google";
import "./globals.css";
import { Spotlight } from "./fx";
import { Wordmark } from "./logo";
import { ScrollFx } from "./story";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoMalayalam = Noto_Sans_Malayalam({ variable: "--font-noto-malayalam", subsets: ["malayalam"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://pathya.anukritiai.com"),
  title: "Pathya",
  description: "Pharmacogenomic result in, oncologist-ready toxicity report out, in the patient's language.",
  openGraph: { title: "Pathya · Chemo toxicity, caught before cycle one", type: "website", siteName: "Pathya" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${notoMalayalam.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Spotlight />
        <ScrollFx />
        <header className="sticky top-0 z-30 bg-[rgba(6,8,10,0.72)] backdrop-blur-xl print:hidden">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
            <Link href="/" className="flex items-baseline gap-2.5">
              <Wordmark className="text-[24px] leading-none" />
              <span className="ml text-sm text-muted">പഥ്യം</span>
            </Link>
            <span className="hidden text-xs text-muted md:inline">by Anukriti AI · Kochi</span>
            <span className="ml-auto hidden items-center gap-2 sm:flex">
              <span className="badge badge-det">PharmCAT 3.4 · CPIC</span>
              <span className="badge badge-meta">Muse Spark 1.3</span>
              <span className="badge badge-meta">Muse Voice</span>
              <span className="badge badge-meta">Spark Open</span>
            </span>
          </div>
          <div aria-hidden className="hairline" />
        </header>
        <div className="flex-1">{children}</div>
        <footer className="mt-16 border-t border-line px-4 py-6 text-center text-xs text-muted print:hidden">
          Decision support for clinicians. Dose text is CPIC / DPWG / FDA-label wording via PharmCAT. Meta Global AI Developer Hackathon 2026.
        </footer>
      </body>
    </html>
  );
}
