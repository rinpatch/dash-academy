"use client";

import Link from "next/link";
import { Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { DashAcademyLogo } from "@/components/site/dash-academy-logo";
import { WalletConnect } from "@/components/site/wallet-connect";

const navLinks = [
  { label: "Lessons", href: "/learn/what-is-dash-platform" },
  // ponytail: Community/Resources/My Profile have no destination yet, shown inert until those pages exist
  { label: "Community", href: null },
  { label: "Resources", href: null },
  { label: "My Profile", href: null },
];

export function SiteHeader() {
  const { setOpenSearch } = useSearchContext();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 rounded-b-3xl border-b border-foreground/12 bg-card">
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/learn/what-is-dash-platform" className="shrink-0">
          <DashAcademyLogo />
        </Link>

        <nav className="hidden items-center gap-12 text-sm font-medium md:flex">
          {navLinks.map((link) =>
            link.href ? (
              <Link key={link.label} href={link.href} className="font-extrabold text-primary">
                {link.label}
              </Link>
            ) : (
              <span key={link.label} className="text-foreground/48">
                {link.label}
              </span>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenSearch(true)}
            aria-label="Search lessons"
            className="flex size-10 items-center justify-center rounded-xl border border-foreground/24 text-foreground/64 transition-colors hover:bg-foreground/5"
          >
            <Search size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle color theme"
            className="flex size-10 items-center justify-center rounded-xl border border-foreground/24 text-foreground/64 transition-colors hover:bg-foreground/5"
          >
            {resolvedTheme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
