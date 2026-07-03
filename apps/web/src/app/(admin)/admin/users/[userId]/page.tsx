"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, Flag, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { BanActionDialog } from "@/components/BanActionDialog";
import { api } from "@/lib/api/client";
import { loadAdminSession } from "@/lib/session";
import { shortTime, timeAgo } from "@/lib/time";
import type { ReportReason } from "@/lib/types";

const REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment",
  spam: "Spam",
  hate: "Hate",
  threat: "Threat",
  sexual: "Sexual content",
  personal_info: "Personal info",
  off_topic: "Off-topic",
  other: "Other",
};

const labelReason = (r: string) => (REASON_LABELS as Record<string, string>)[r] ?? r;

export default function UserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && !loadAdminSession()) {
      router.replace("/admin/login");
    }
  }, [router]);

  const userQ = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => api.admin.user(userId),
  });
  const reportsQ = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => api.admin.reports(),
  });
  const messagesQ = useQuery({
    queryKey: ["admin-messages-all"],
    queryFn: async () => {
      const rooms = await api.admin.rooms();
      const lists = await Promise.all(rooms.map((r) => api.admin.roomMessages(r.id)));
      return { rooms, messages: lists.flat() };
    },
  });

  const user = userQ.data;

  const userReports = useMemo(
    () =>
      (reportsQ.data ?? []).filter(
        (r) => r.reportedUserId === userId || r.targetId === userId,
      ),
    [reportsQ.data, userId],
  );

  const userMessages = useMemo(
    () => (messagesQ.data?.messages ?? []).filter((m) => m.userId === userId),
    [messagesQ.data, userId],
  );

  const roomActivity = useMemo(() => {
    const rooms = messagesQ.data?.rooms ?? [];
    const counts = new Map<string, { count: number; last: string }>();
    for (const m of userMessages) {
      const cur = counts.get(m.roomId);
      if (!cur) counts.set(m.roomId, { count: 1, last: m.createdAt });
      else {
        cur.count += 1;
        if (m.createdAt > cur.last) cur.last = m.createdAt;
      }
    }
    return Array.from(counts.entries())
      .map(([roomId, v]) => {
        const room = rooms.find((r) => r.id === roomId);
        return {
          roomId,
          roomName: room?.name ?? roomId,
          count: v.count,
          lastActive: v.last,
        };
      })
      .sort((a, b) => (a.lastActive < b.lastActive ? 1 : -1));
  }, [messagesQ.data, userMessages]);

  const reportedMessageIds = useMemo(
    () => new Set(userReports.filter((r) => r.targetType === "message").map((r) => r.targetId)),
    [userReports],
  );

  const [dialog, setDialog] = useState(false);

  if (userQ.isLoading) {
    return (
      <AdminShell>
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-lg border border-border" />
          <div className="h-40 animate-pulse rounded-lg border border-border" />
          <div className="h-40 animate-pulse rounded-lg border border-border" />
        </div>
      </AdminShell>
    );
  }

  if (userQ.isError) {
    return (
      <AdminShell>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Could not load user</p>
          <button
            onClick={() => userQ.refetch()}
            className="mt-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            Retry
          </button>
        </div>
      </AdminShell>
    );
  }

  if (!user) {
    return (
      <AdminShell>
        <BackLink />
        <div className="mt-4 rounded-lg border border-border bg-card px-4 py-8 text-center">
          <p className="text-sm font-medium">User not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The user id <span className="font-mono">{userId}</span> does not exist or was removed.
          </p>
        </div>
      </AdminShell>
    );
  }

  const banBadge = user.currentBan ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
      <Ban className="h-3 w-3" /> {user.currentBan.kind.replace("_", " ")}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      no restriction
    </span>
  );

  return (
    <AdminShell>
      <BackLink />

      <section className="mt-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="h-10 w-10 flex-shrink-0 rounded-full ring-1 ring-border"
              style={{ backgroundColor: user.displayColor }}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold" style={{ color: user.displayColor }}>
                  {user.displayName}
                </h1>
                {banBadge}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="font-mono">{user.id}</span> · joined {timeAgo(user.createdAt)} · last seen{" "}
                {timeAgo(user.lastSeenAt)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90"
          >
            <Ban className="h-3.5 w-3.5" /> Moderate
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric k="Reports" v={String(userReports.length || user.reportCount)} tone={userReports.length ? "warn" : undefined} />
          <Metric k="Messages" v={String(userMessages.length)} />
          <Metric k="Rooms active" v={String(roomActivity.length)} />
          <Metric k="Prior bans" v={String(user.banHistory.length)} />
        </div>
      </section>

      <SectionCard title="Reports involving this user" count={userReports.length}>
        {reportsQ.isLoading ? (
          <RowSkeleton />
        ) : userReports.length === 0 ? (
          <Empty text="No reports filed against this user." />
        ) : (
          <ul className="divide-y divide-border">
            {userReports.map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {labelReason(String(r.reason))}
                      </span>
                      <span className="text-muted-foreground">
                        {r.context?.roomName ? `in #${r.context.roomName}` : r.targetType}
                      </span>
                      <StatusPill status={r.status} />
                    </div>
                    {r.context?.messageContent && (
                      <p
                        className="mt-1 text-xs text-foreground/90"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                      >
                        "{r.context.messageContent}"
                      </p>
                    )}
                    {r.details && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Note: {r.details}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {r.reporterId ? `by ${r.reporterId}` : "anonymous"} · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Link
                      href="/admin/reports"
                      className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Recent messages" count={userMessages.length}>
        {messagesQ.isLoading ? (
          <RowSkeleton />
        ) : userMessages.length === 0 ? (
          <Empty text="No messages from this user." />
        ) : (
          <ul className="divide-y divide-border">
            {userMessages.slice(0, 20).map((m) => (
              <li key={m.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Link
                        href={`/admin/rooms/${m.roomId}`}
                        className="rounded-md border border-border px-1.5 py-0.5 text-foreground hover:bg-accent"
                      >
                        #{messagesQ.data?.rooms.find((r) => r.id === m.roomId)?.name ?? m.roomId}
                      </Link>
                      <span>·</span>
                      <span>{shortTime(m.createdAt)}</span>
                      {reportedMessageIds.has(m.id) && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-warning">
                          <Flag className="h-2.5 w-2.5" /> reported
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 text-sm text-foreground/90"
                      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {m.deleted ? <span className="italic text-muted-foreground">message deleted</span> : m.content}
                    </p>
                  </div>
                  <MessageSquare className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Rooms / activity" count={roomActivity.length}>
        {roomActivity.length === 0 ? (
          <Empty text="No room activity recorded." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Messages</th>
                <th className="px-4 py-2 font-medium">Last active</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roomActivity.map((r) => (
                <tr key={r.roomId} className="hover:bg-accent/40">
                  <td className="px-4 py-2 font-medium">#{r.roomName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.count}</td>
                  <td className="px-4 py-2 text-muted-foreground">{timeAgo(r.lastActive)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/rooms/${r.roomId}`}
                      className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Ban history" count={user.banHistory.length}>
        {user.banHistory.length === 0 ? (
          <Empty text="No prior bans." />
        ) : (
          <ul className="divide-y divide-border">
            {user.banHistory.map((b, i) => (
              <li key={i} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {b.kind.replace("_", " ")}
                    </span>
                    <span className="text-xs text-foreground">{b.reason ?? "-"}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {b.expiresAt ? `until ${new Date(b.expiresAt).toLocaleString()}` : "permanent"}
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">by admin</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <BanActionDialog
        open={dialog}
        onClose={() => setDialog(false)}
        target={user.displayName}
        allowedKinds={["read_only", "hard", "quarantine"]}
        onSubmit={async (b) => {
          await api.admin.banUser({
            userId: user.id,
            kind: b.kind,
            reason: b.reason,
            expiresAt: b.expiresAt,
          });
          toast.success("Ban applied");
          userQ.refetch();
        }}
      />
    </AdminShell>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to overview
    </Link>
  );
}

function Metric({ k, v, tone }: { k: string; v: string; tone?: "warn" }) {
  return (
    <div
      className={
        "rounded-md border p-2 " +
        (tone === "warn" ? "border-warning/40 bg-warning/5" : "border-border bg-background")
      }
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-sm font-semibold">{v}</div>
    </div>
  );
}

function SectionCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {typeof count === "number" && (
          <span className="text-[11px] text-muted-foreground">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-xs text-muted-foreground">{text}</div>;
}

function RowSkeleton() {
  return (
    <div className="space-y-2 px-4 py-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: "open" | "resolved" | "dismissed" }) {
  const map: Record<string, string> = {
    open: "border-warning/40 bg-warning/10 text-warning",
    resolved: "border-success/40 bg-success/10 text-success",
    dismissed: "border-border bg-muted/40 text-muted-foreground",
  };
  return (
    <span className={"inline-flex rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide " + (map[status] ?? map.dismissed)}>
      {status}
    </span>
  );
}
