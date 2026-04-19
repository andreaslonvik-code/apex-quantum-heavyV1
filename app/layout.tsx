import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { LegalDisclaimers } from "@/components/legal-disclaimers";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "APEX QUANTUM v6.1 | AI-Powered Autonomous Trading Engine",
  description: "Production-grade autonomous AI trading engine with Grok-4-Heavy backend. Multi-exchange support (US/Oslo/XETRA/HK), aggressive day-trading with 10-12% daily target, real-time streaming, and advanced risk management.",
  keywords: ["trading", "AI", "autonomous", "algorithmic trading", "day trading"],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "APEX QUANTUM v6.1",
    description: "Next-generation autonomous trading powered by AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased bg-background scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white overflow-x-hidden">
        <div className="scanline" />
        <LegalDisclaimers />
        {children}
        <Toaster 
          position="top-right" 
          theme="dark"
          toastOptions={{
            style: {
              background: 'rgba(17, 17, 19, 0.95)',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              color: '#fff',
              fontSize: '0.875rem',
            },
          }}
        />
      </body>
    </html>
  );
}
