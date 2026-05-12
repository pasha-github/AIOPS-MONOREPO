/**
 * Root Layout Component
 * Provides the base HTML structure, font styling, and metadata for NovaCart.
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Chatbot from "@/components/Chatbot";
import Footer from "@/components/Footer";

// Configure standard Inter font
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "NovaCart Retail | Shop the Future",
  description: "Next-generation eCommerce platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans" suppressHydrationWarning>
        {children}
        <Footer />
        <Chatbot />
      </body>
    </html>
  );
}
