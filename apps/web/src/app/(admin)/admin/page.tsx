"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Ban, Flag, LayoutGrid, User } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api/client";
import { loadAdminSession } from "@/lib/session";
import { timeAgo } from "@/lib/time";

export default function AdminOverviewPage() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined" && !loadAdminSession()) {
      router.replace("/admin/login");
    }
  }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api.admin.overview(),
  });

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">Moderation snapshot.</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Flag}
          label="Open reports"
          value={isLoading ? "-" : String(data?.openReports ?? 0)}
          to="/admin/reports"
        />
        <StatCard
          icon={Ban}
          label="Active bans"
          value={isLoading ? "-" : String(data?.activeBans ?? 0)}
          to="/admin/reports"
        />
        <StatCard
          icon={LayoutGrid}
          label="Rooms"
          value={isLoading ? "-" : String(data?.recentRooms.length ?? 0)}
          to="/admin/rooms"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-medium">Recent rooms</h2>
            <Link href="/admin/rooms" className="text-xs text-muted-foreground hover:text-foreground">
              View all {"->"}
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {(data?.recentRooms ?? []).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/rooms/${r.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-accent/60"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.participantCount} in room</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(r.lastActivityAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-medium">Recent activity</h2>
          </div>
          <ul className="divide-y divide-border">
            {(data?.recentActions ?? []).map((a) => (
              <li key={a.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate">
                    <span className="text-muted-foreground">{a.admin}</span> {a.action}{" "}
                    <span className="font-medium">{a.target}</span>
                  </span>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">{timeAgo(a.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-medium">Flagged users</h2>
          <span className="text-xs text-muted-foreground">Recent moderation targets</span>
        </div>
        <ul className="divide-y divide-border">
          {(data?.flaggedUsers ?? []).map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/users/${u.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-accent/60"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-6 w-6 flex-shrink-0 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: u.displayColor }}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.reportCount} report{u.reportCount === 1 ? "" : "s"} · last seen {timeAgo(u.lastSeenAt)}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> Open
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Flag;
  label: string;
  value: string;
  to: "/admin/reports" | "/admin/rooms";
}) {
  return (
    <Link
      href={to}
      className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/60"
    >
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
