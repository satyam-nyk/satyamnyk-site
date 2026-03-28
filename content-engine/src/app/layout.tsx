import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import MobileMenu from "@/components/MobileMenu";
import { blogTheme } from "@/lib/config/blogTheme";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: blogTheme.publicationName,
  description: blogTheme.metaDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_36%),linear-gradient(180deg,_#f8fafc_0%,_#f3f6fb_100%)] text-zinc-900">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur-xl">
          <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-950">
              {blogTheme.publicationName}
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden items-center gap-5 text-sm text-zinc-700 md:flex">
              <Link href="/" className="hover:text-zinc-950">
                Home
              </Link>
              <Link href="/blog" className="hover:text-zinc-950">
                Latest
              </Link>
              <Link href="/category/tech" className="hover:text-zinc-950">
                AI + PM
              </Link>
              <Link href="/category/history" className="hover:text-zinc-950">
                History + Lessons
              </Link>
            </div>

            {/* Mobile Navigation */}
            <MobileMenu />
          </nav>
        </header>
        <div className="flex min-h-[calc(100vh-73px)] flex-col">{children}</div>
      </body>
    </html>
  );
}
