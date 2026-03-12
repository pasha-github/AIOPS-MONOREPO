import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerRuntimeConfig } from "@/config/agent";
import { RuntimeConfigProvider } from "@/config/runtime-config";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RC AIOPS",
  description: "Royal Cyber AIOPS for Enterprise",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimeConfig = getServerRuntimeConfig();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RuntimeConfigProvider config={runtimeConfig}>
          {children}
        </RuntimeConfigProvider>
      </body>
    </html>
  );
}
