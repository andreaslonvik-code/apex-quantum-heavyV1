import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { LegalDisclaimers } from "@/components/legal-disclaimers";
import { ClerkProvider } from "@clerk/nextjs";

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

export const metadata: Metadata = {
  title: "APEX QUANTUM · Autonomous Trading Intelligence",
  description:
    "Self-directing AI trading system. Scans nine million signals a second, evolves its own strategies in real time, and compounds capital 24/7 — without you lifting a finger.",
  keywords: ["autonomous trading", "AI", "algorithmic trading", "quantitative finance", "Saxo Bank"],
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "APEX QUANTUM · Autonomous Trading Intelligence",
    description: "+187% YTD · 4,12 Sharpe · 73,4% win rate · 24/7 autonomous",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05050A",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html
        lang="no"
        className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
        <body className="min-h-full flex flex-col overflow-x-hidden" style={{ background: 'var(--aq-bg)', color: 'var(--aq-text)' }}>
          <div className="scanline" aria-hidden="true" />
          <LegalDisclaimers />
          {children}
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "rgba(10,10,16,0.95)",
                border: "1px solid rgba(0,245,255,0.18)",
                color: "#fff",
                fontSize: "0.875rem",
                backdropFilter: "blur(20px)",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
