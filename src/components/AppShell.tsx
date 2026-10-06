"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS } from "@/components/nav-items";
import { IconMenu, IconClose, IconSpool } from "@/components/icons";

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <IconSpool className="h-5 w-5" />
      </span>
      <span className="text-base font-semibold text-white">Felps 3D</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;

        if (item.comingSoon) {
          return (
            <div
              key={item.href}
              className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50"
              title="Em breve"
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </span>
              <span className="rounded-full border border-sidebar-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                Em breve
              </span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-active text-sidebar-active-foreground"
                : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-full">
      {/* Sidebar - desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <Brand />
        <NavLinks />
      </aside>

      {/* Sidebar - mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 bg-sidebar px-3 py-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-sidebar-foreground hover:bg-white/10"
                aria-label="Fechar menu"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar - mobile only */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-foreground hover:bg-muted"
            aria-label="Abrir menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <span className="flex-1 text-sm font-semibold">Felps 3D</span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
