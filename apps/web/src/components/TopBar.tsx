import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { User, MapPin } from "lucide-react";
import type { AnonSession } from "@/lib/types";

export function TopBar({
  maxWidth = "max-w-5xl",
  session,
}: {
  maxWidth?: string;
  session: AnonSession | null;
}) {
  const locState = session?.writeAccess.kind;
  const locLabel =
    locState === "allowed" ? "on campus"
    : locState === "off_campus" ? "off campus"
    : locState === "denied" ? "location denied"
    : locState === "error" ? "location error"
    : "location unverified";
  const locColor =
    locState === "allowed" ? "text-[color:var(--success)]"
    : locState === "off_campus" || locState === "denied" || locState === "error"
    ? "text-[color:var(--warning)]"
    : "text-muted-foreground";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className={`mx-auto flex h-14 ${maxWidth} items-center justify-between gap-2 px-4`}>
        <Link href="/rooms" className="flex items-center gap-2 text-sm font-medium tracking-tight">
          <span className="h-2 w-2 rounded-full bg-primary" />
          campus
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/verify-location"
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${locColor} hover:bg-accent transition-colors`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate max-w-[10rem]">{locLabel}</span>
          </Link>
          <ThemeToggle />
          <Link
            href="/me"
            aria-label="profile"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {session ? (
              <span
                className="h-4 w-4 rounded-full ring-1 ring-border"
                style={{ backgroundColor: session.displayColor }}
              />
            ) : (
              <User className="h-4 w-4" />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
