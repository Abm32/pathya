import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Noto_Sans_Malayalam } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoMalayalam = Noto_Sans_Malayalam({ variable: "--font-noto-malayalam", subsets: ["malayalam"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Pathya",
  description: "Pharmacogenomic result in, oncologist-ready toxicity report out, in the patient's language.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${notoMalayalam.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-card print:hidden">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight text-accent">Pathya</span>
              <span className="ml text-sm text-muted">പഥ്യം</span>
            </Link>
            <span className="text-xs text-muted">by Anukriti AI · Kochi</span>
            <span className="ml-auto hidden gap-2 sm:flex">
              <span className="badge badge-det">PharmCAT · CPIC</span>
              <span className="badge badge-meta">Muse Spark</span>
              <span className="badge badge-meta">Muse Voice</span>
            </span>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line py-4 text-center text-xs text-muted print:hidden">
          Decision support for clinicians. Dose text is CPIC / DPWG / FDA-label wording via PharmCAT. Meta Global AI Developer Hackathon 2026.
        </footer>
      </body>
    </html>
  );
}
