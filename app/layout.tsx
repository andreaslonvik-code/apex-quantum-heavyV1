import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

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
  title: "APEX QUANTUM v7 | Multi-Exchange 24/7 Autonomous Trading",
  description: "Production-grade autonomous AI trading engine. Multi-exchange support (US/Oslo/XETRA/HK), aggressive day-trading with 10-12% daily target, self-cleaning architecture.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="no"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white">
        <div className="scanline" />
        {children}
        <Toaster 
          position="top-right" 
          theme="dark"
          toastOptions={{
            style: {
              background: 'rgba(17, 17, 19, 0.95)',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  );
}
