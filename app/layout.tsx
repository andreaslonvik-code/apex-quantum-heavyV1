import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./styles/tokens.css";
import { Toaster } from "sonner";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Apex Quantum — AI-drevet aksjeinnsikt og autonom handel",
  description:
    "Daglige AI-signaler med fullstendig begrunnelse, og en autonom handelsmotor under utvikling. Alle resultater fra dokumentert paper trading.",
  keywords: [
    "AI-signaler",
    "aksjeanalyse",
    "autonom handel",
    "algorithmic trading",
    "paper trading",
  ],
  openGraph: {
    title: "Apex Quantum — AI-drevet aksjeinnsikt og autonom handel",
    description:
      "Daglige AI-signaler med fullstendig begrunnelse. Alle resultater fra dokumentert paper trading — publisert åpent, dag for dag.",
    type: "website",
    siteName: "Apex Quantum",
    locale: "nb_NO",
  },
};

export function generateViewport(): Viewport {
  return {
    themeColor: "#0A1424",
    width: "device-width",
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 5,
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html
        lang="no"
        className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <meta name="color-scheme" content="dark" />
          <link rel="preconnect" href="https://api.fontshare.com" />
          <link
            href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          className="min-h-full flex flex-col overflow-x-hidden"
          style={{ background: "var(--aq-ink)", color: "var(--aq-text)" }}
        >
          {children}
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "var(--aq-ink-deep)",
                border: "1px solid var(--aq-border-warm)",
                color: "var(--aq-text)",
                fontSize: "0.875rem",
              },
            }}
          />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
