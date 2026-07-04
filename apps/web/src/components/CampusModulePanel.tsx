"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bed,
  BookOpenCheck,
  X,
  Compass,
  HelpCircle,
  Map,
  MessageCircle,
  Newspaper,
  PanelLeft,
  Timer,
  Vote,
  type LucideIcon,
} from "lucide-react";

interface CampusModule {
  description: string;
  href?: string;
  icon: LucideIcon;
  label: string;
  status: "active" | "soon";
}

const MODULES: CampusModule[] = [
  {
    description: "Anonymous rooms and live campus chatter.",
    href: "/rooms",
    icon: MessageCircle,
    label: "Chat rooms",
    status: "active",
  },
  {
    description: "Buildings, hostels, and useful spots.",
    href: "/map",
    icon: Map,
    label: "Campus map",
    status: "active",
  },
  {
    description: "Campus updates and notices.",
    icon: Newspaper,
    label: "News",
    status: "soon",
  },
  {
    description: "Quick votes from students.",
    icon: Vote,
    label: "Polls",
    status: "soon",
  },
  {
    description: "Exam and academic result links.",
    icon: BookOpenCheck,
    label: "Results",
    status: "soon",
  },
  {
    description: "Hostel rooms and availability signals.",
    icon: Bed,
    label: "Hostels",
    status: "soon",
  },
  {
    description: "Study sessions and deep work rooms.",
    icon: Timer,
    label: "Focus",
    status: "soon",
  },
  {
    description: "Requests, ideas, and community help.",
    icon: HelpCircle,
    label: "Help us",
    status: "soon",
  },
];

export function CampusModulePanel() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close Afwaah modules" : "Open Afwaah modules"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close Afwaah modules"
          className="fixed inset-0 z-30 bg-background/45 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <aside className="fixed left-0 top-0 z-40 h-screen w-[min(20rem,calc(100vw-2rem))] border-r border-border bg-card p-4 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
                <Compass className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight">
                  Afwaah
                </h2>
                <p className="text-[11px] text-muted-foreground">Modules</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close modules"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex min-w-0 flex-col gap-2">
            {MODULES.map((module) => (
              <ModuleItem
                key={module.label}
                active={Boolean(module.href && pathname.startsWith(module.href))}
                module={module}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>
        </aside>
      )}
    </>
  );
}

function ModuleItem({
  active = false,
  compact = false,
  module,
  onNavigate,
}: {
  active?: boolean;
  compact?: boolean;
  module: CampusModule;
  onNavigate?: () => void;
}) {
  const Icon = module.icon;
  const content = (
    <>
      <span
        className={
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border " +
          (active
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground")
        }
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{module.label}</span>
          {module.status === "soon" && (
            <span className="flex-shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Soon
            </span>
          )}
        </span>
        <span
          className={
            "mt-0.5 text-[11px] leading-4 text-muted-foreground " +
            (compact ? "hidden sm:block" : "block")
          }
        >
          {module.description}
        </span>
      </span>
    </>
  );

  const classes =
    "flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors " +
    (active
      ? "border-primary/40 bg-primary/10 text-foreground"
      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground");

  if (module.href) {
    return (
      <Link href={module.href} className={classes} onClick={onNavigate}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" disabled aria-disabled="true" className={classes}>
      {content}
    </button>
  );
}
