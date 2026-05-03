"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteNav } from "../mock/data";
import { useAuthSession } from "@/lib/firebase/auth";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const access = useAuthSession();
  const initials = access.authUser?.profile
    ? `${access.authUser.profile.firstName?.[0] ?? ""}${access.authUser.profile.lastName?.[0] ?? ""}`.toUpperCase()
    : "U";

  function clearFavoriteDemoCookies() {
    document.cookie =
      "air-favorite-preference=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
    document.cookie =
      "air-favorite-prompt-dismissed=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
  }

  function handleLogoClick() {
    setMenuOpen(false);
    clearFavoriteDemoCookies();

    if (pathname === "/") {
      window.location.reload();
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[color:var(--paper)]/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" onClick={handleLogoClick}>
            <div className="rounded-2xl border border-[color:var(--line)] bg-white p-2 shadow-[0_10px_30px_rgba(18,38,63,0.08)]">
              <Image
                src="/air-logo.png"
                alt="Air Volleyball Club"
                width={52}
                height={52}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            <div>
              <p className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.18em] text-[color:var(--ink)]">
                Air
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                Volleyball Club
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {access.authUser && (
              <Link
                href="/profile"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--line)] bg-white text-sm font-bold text-[color:var(--ink)] shadow-[0_10px_25px_rgba(18,38,63,0.08)] transition hover:bg-[color:var(--paper)] lg:hidden"
                aria-label="Open profile"
                onClick={() => setMenuOpen(false)}
              >
                {initials || "U"}
              </Link>
            )}

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--ink)] shadow-[0_10px_25px_rgba(18,38,63,0.08)] lg:hidden"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="mr-2">Menu</span>
              <span className="text-lg leading-none">{menuOpen ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 hidden items-center justify-between gap-4 lg:flex">
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
            {siteNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 transition hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--ink)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {access.authUser && (
            <Link
              href="/profile"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--line)] bg-white text-sm font-bold text-[color:var(--ink)] shadow-[0_10px_25px_rgba(18,38,63,0.08)] transition hover:bg-[color:var(--paper)]"
              aria-label="Open profile"
            >
              {initials || "U"}
            </Link>
          )}
        </div>

        {menuOpen && (
          <nav className="mt-4 grid gap-2 rounded-[1.5rem] border border-[color:var(--line)] bg-white p-3 shadow-[0_16px_40px_rgba(18,38,63,0.08)] lg:hidden">
            {siteNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {access.authUser && (
              <Link
                href="/profile"
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
