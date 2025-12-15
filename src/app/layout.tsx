import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DevToolsProvider } from "@/lib/providers/DevToolsProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Proxy Auth - OTP Provider",
  description: "Next.js experience for proxy authentication and OTP verification.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased bg-app-surface text-body`}>
        <DevToolsProvider maxAge={25} serialize={true}>
          {children}
        </DevToolsProvider>
      </body>
    </html>
  );
}
