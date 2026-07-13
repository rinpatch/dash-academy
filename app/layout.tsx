import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dash Academy",
    template: "%s · Dash Academy",
  },
  description: "Learn Dash Platform by doing real, verifiable work on testnet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${geistMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <RootProvider
          theme={{ enabled: true, defaultTheme: "system", enableSystem: true }}
          search={{ options: { api: "/api/search" } }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
