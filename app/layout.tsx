import type { Metadata } from "next";
import { Bebas_Neue, Manrope } from "next/font/google";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Air Volleyball Club",
  description: "Youth volleyball teams, camps, tryouts, private lessons, and parent portal tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <div className="site-frame">
          <SiteHeader />
          <main className="mx-auto flex min-h-[calc(100vh-13rem)] w-full max-w-7xl flex-col gap-8 px-4 py-8 lg:px-6 lg:py-10">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
