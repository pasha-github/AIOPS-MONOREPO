import type { Metadata } from "next";
import { getServerRuntimeConfig } from "@/config/agent";
import { RuntimeConfigProvider } from "@/config/runtime-config";
import "./globals.css";

export const dynamic = "force-dynamic";

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
      <body className="antialiased">
        <RuntimeConfigProvider config={runtimeConfig}>
          {children}
        </RuntimeConfigProvider>
      </body>
    </html>
  );
}
