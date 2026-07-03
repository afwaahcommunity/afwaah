import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Flag, Home, LayoutGrid, LogOut, Settings, Users } from "lucide-react";
import { clearAdminSession, loadAdminSession } from "@/lib/session";

const nav: {
  to:
    | "/admin"
    | "/admin/reports"
    | "/admin/rooms"
    | "/admin/settings"
    | "/admin/users";
  label: string;
  icon: typeof Home;
  exact?: boolean;
}[] = [
  { to: "/admin", label: "Overview", icon: Home, exact: true },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/rooms", label: "Rooms", icon: LayoutGrid },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const admin = typeof window !== "undefined" ? loadAdminSession() : null;
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              className="h-2 w-2 rounded-full bg-warning"
              style={{ backgroundColor: "var(--warning)" }}
            />
            campus / admin
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {admin?.name ?? "not signed in"}
            </span>
            <ThemeToggle />
            <button
              onClick={() => {
                clearAdminSession();
                router.push("/admin/login");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[12rem_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {nav.map((n) => {
              const active = n.exact
                ? pathname === n.to
                : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  href={n.to}
                  className={
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors " +
                    (active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground")
                  }
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
