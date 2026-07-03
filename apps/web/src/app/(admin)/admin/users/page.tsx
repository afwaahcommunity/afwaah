"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api/client";
import { loadAdminSession } from "@/lib/session";
import { timeAgo } from "@/lib/time";

export default function AdminUsersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !loadAdminSession()) {
      router.replace("/admin/login");
    }
  }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.admin.users(),
  });

  const users = (data ?? []).filter((u) => {
    const query = q.toLowerCase();
    return u.displayName.toLowerCase().includes(query) || u.id.toLowerCase().includes(query);
  });

  return (
    <AdminShell>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Users</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Review recent moderation targets.</p>
        </div>
        <div className="relative w-64 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">User</th>
              <th className="px-3 py-2 text-left font-medium">Reports</th>
              <th className="px-3 py-2 text-left font-medium">Current ban</th>
              <th className="px-3 py-2 text-left font-medium">Last seen</th>
              <th className="px-3 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Loading users...
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2.5">
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2.5 hover:underline">
                    <span
                      className="h-6 w-6 flex-shrink-0 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: u.displayColor }}
                    />
                    <span>
                      <span className="block font-medium">{u.displayName}</span>
                      <span className="text-xs text-muted-foreground">{u.id}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5">{u.reportCount}</td>
                <td className="px-3 py-2.5 text-xs uppercase text-muted-foreground">
                  {u.currentBan ? u.currentBan.kind.replace("_", " ") : "none"}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{timeAgo(u.lastSeenAt)}</td>
                <td className="px-3 py-2.5 text-right">
                  <Link href={`/admin/users/${u.id}`} className="text-xs text-primary hover:underline">
                    Open {"->"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
