'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={toggleMenu}
        className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
        aria-label="Toggle menu"
      >
        <span
          className={`h-0.5 w-6 bg-zinc-950 transition-all duration-300 ${
            isOpen ? 'translate-y-2 rotate-45' : ''
          }`}
        />
        <span
          className={`h-0.5 w-6 bg-zinc-950 transition-all duration-300 ${
            isOpen ? 'opacity-0' : ''
          }`}
        />
        <span
          className={`h-0.5 w-6 bg-zinc-950 transition-all duration-300 ${
            isOpen ? '-translate-y-2 -rotate-45' : ''
          }`}
        />
      </button>

      {/* Mobile Menu */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 top-[73px] bg-black/20 backdrop-blur-sm md:hidden"
            onClick={closeMenu}
          />

          {/* Slide-out Menu */}
          <div className="fixed right-0 top-[73px] z-50 h-[calc(100vh-73px)] w-full bg-white shadow-xl md:hidden">
            <nav className="flex flex-col gap-0 p-6">
              <Link
                href="/"
                onClick={closeMenu}
                className="border-b border-zinc-100 px-4 py-4 text-lg font-medium text-zinc-950 hover:text-teal-700"
              >
                Home
              </Link>
              <Link
                href="/blog"
                onClick={closeMenu}
                className="border-b border-zinc-100 px-4 py-4 text-lg font-medium text-zinc-950 hover:text-teal-700"
              >
                Latest
              </Link>
              <Link
                href="/category/tech"
                onClick={closeMenu}
                className="border-b border-zinc-100 px-4 py-4 text-lg font-medium text-zinc-950 hover:text-teal-700"
              >
                AI + PM
              </Link>
              <Link
                href="/category/history"
                onClick={closeMenu}
                className="border-b border-zinc-100 px-4 py-4 text-lg font-medium text-zinc-950 hover:text-teal-700"
              >
                History + Lessons
              </Link>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
