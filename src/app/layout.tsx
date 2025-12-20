import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/toast";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SAAR Proxy Console",
  description: "Next.js experience for managing SAAR proxy traffic and features.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} proxy-console antialiased bg-app-surface text-body`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
