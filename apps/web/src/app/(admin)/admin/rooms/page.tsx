"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Search } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api/client";
import { loadAdminSession } from "@/lib/session";
import { timeAgo } from "@/lib/time";

export default function AdminRoomsPage() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined" && !loadAdminSession()) {
      router.replace("/admin/login");
    }
  }, [router]);

  const { data, isLoading } = useQuery({ queryKey: ["admin-rooms"], queryFn: () => api.admin.rooms() });
  const [q, setQ] = useState("");

  const filtered = (data ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminShell>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Rooms</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Moderate live rooms.</p>
        </div>
        <div className="relative w-64 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rooms"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 h-32 animate-pulse rounded-lg border border-border" />
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Users</th>
                <th className="px-3 py-2 text-left font-medium">Last activity</th>
                <th className="px-3 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/rooms/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    {r.description && (
                      <div className="max-w-md truncate text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs uppercase text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {r.visibility === "private" && <Lock className="h-3 w-3" />}
                      {r.visibility}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm">{r.participantCount}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{timeAgo(r.lastActivityAt)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Link href={`/admin/rooms/${r.id}`} className="text-xs text-primary hover:underline">
                      Review {"->"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
