import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ToastContainer } from "@/components/ui/ToastContainer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Munim — Your Seller's AI Account Manager",
  description:
    "Munim is a voice-first AI Virtual Key Account Manager for Snapdeal sellers. It diagnoses your sales drop and takes action.",
  openGraph: {
    title: "Munim — Your Seller's AI Account Manager",
    description: "Munim diagnoses your Snapdeal sales drop and fixes it — by voice.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
