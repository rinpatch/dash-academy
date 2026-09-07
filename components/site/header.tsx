"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { DashAcademyLogo } from "@/components/site/dash-academy-logo";
import { SaveProgress } from "@/components/site/save-progress";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";

// `section` is the path prefix the link counts as current for, which is not the href: Lessons
// points at the first lesson but stays current for every lesson under /learn.
const navLinks = [
  { label: "Lessons", href: "/learn/what-is-a-blockchain", section: "/learn" },
  { label: "My Profile", href: "/profile", section: "/profile" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { setOpenSearch } = useSearchContext();
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 rounded-b-3xl border-b border-foreground/12 bg-card">
      {/* Height is fixed so the lesson bar below can stick at exactly --header-height. */}
      {/* A grid with equal side tracks, so the nav sits centred on the bar rather than on
          whatever space the logo and the buttons leave between them. */}
      <div className="mx-auto grid h-18 max-w-[1360px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-8">
        <Link href="/learn/what-is-a-blockchain" className="shrink-0">
          <DashAcademyLogo />
        </Link>

        <nav className="hidden items-center gap-12 text-sm md:flex">
          {navLinks.map((link) => {
            const current = pathname.startsWith(link.section);
            return (
              <Link
                key={link.label}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "font-extrabold text-primary"
                    : "font-medium text-foreground/64 hover:text-foreground"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-self-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOpenSearch(true)}
            aria-label="Search lessons"
            className="rounded-xl"
          >
            <Search size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle color theme"
            className="rounded-xl"
          >
            {/* Both icons ship in the HTML and CSS picks one. next-themes only resolves the
                theme after mount, so branching on it here renders a different icon on the
                server than on the client. */}
            <Sun size={16} aria-hidden="true" className="hidden dark:block" />
            <Moon size={16} aria-hidden="true" className="dark:hidden" />
          </Button>
          <SaveProgress />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-xl md:hidden"
          >
            <Menu size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent title="Menu" className="md:hidden">
          <nav className="flex flex-col gap-1 pb-2 text-base">
            {navLinks.map((link) => {
              const current = pathname.startsWith(link.section);
              return (
                <SheetClose asChild key={link.label}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`rounded-2xl px-2 py-3 ${
                      current ? "font-extrabold text-primary" : "font-medium text-foreground/64"
                    }`}
                  >
                    {link.label}
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
