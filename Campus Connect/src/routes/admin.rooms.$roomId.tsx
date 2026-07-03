import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { BanActionDialog } from "@/components/BanActionDialog";
import { api } from "@/lib/api/client";
import { loadAdminSession } from "@/lib/session";
import { timeAgo } from "@/lib/time";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Copy,
  Globe,
  Lock,
  MoreHorizontal,
  RefreshCw,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Report } from "@/lib/types";

export const Route = createFileRoute("/admin/rooms/$roomId")({
  head: () => ({
    meta: [{ title: "Room — admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminRoomDetail,
});

type Participant = {
  userId: string;
  displayName: string;
  displayColor: string;
  lastActiveAt: string;
  messageCount: number;
  isRoomOwner?: boolean;
};

function AdminRoomDetail() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== "undefined" && !loadAdminSession()) {
      navigate({ to: "/admin/login", replace: true });
    }
  }, [navigate]);

  const roomQ = useQuery({
    queryKey: ["admin-room", roomId],
    queryFn: () => api.admin.room(roomId),
  });
  const messagesQ = useQuery({
    queryKey: ["admin-room-messages", roomId],
    queryFn: () => api.messages.list(roomId),
  });
  const reportsQ = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => api.admin.reports(),
  });

  const room = roomQ.data;
  const messages = messagesQ.data ?? [];

  const participants: Participant[] = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const m of messages) {
      const cur = map.get(m.userId);
      if (cur) {
        cur.messageCount += 1;
        if (m.createdAt > cur.lastActiveAt) cur.lastActiveAt = m.createdAt;
      } else {
        map.set(m.userId, {
          userId: m.userId,
          displayName: m.displayName,
          displayColor: m.displayColor,
          lastActiveAt: m.createdAt,
          messageCount: 1,
          isRoomOwner: room?.createdBy === m.userId,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.lastActiveAt < b.lastActiveAt ? 1 : -1));
  }, [messages, room?.createdBy]);

  const roomReports: Report[] = useMemo(() => {
    if (!reportsQ.data || !room) return [];
    const msgIds = new Set(messages.map((m) => m.id));
    return reportsQ.data.filter((r) => {
      if (r.targetType === "room" && (r.targetId === room.id || r.context?.roomName === room.name)) return true;
      if (r.targetType === "message" && (msgIds.has(r.targetId) || r.context?.roomName === room.name)) return true;
      return false;
    });
  }, [reportsQ.data, room, messages]);

  const [banTarget, setBanTarget] = useState<Participant | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [inviteEnabled, setInviteEnabled] = useState(true);
  const [inviteCode, setInviteCode] = useState("A4F9-K21X");

  // ── Loading / error / not found ────────────────────────────────
  if (roomQ.isLoading) {
    return (
      <AdminShell>
        <BackLink />
        <div className="mt-4 space-y-3">
          <div className="h-8 w-64 animate-pulse rounded-md bg-muted/50" />
          <div className="h-4 w-96 animate-pulse rounded-md bg-muted/50" />
          <div className="h-40 animate-pulse rounded-lg border border-border" />
        </div>
      </AdminShell>
    );
  }

  if (roomQ.isError) {
    return (
      <AdminShell>
        <BackLink />
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Failed to load room
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {(roomQ.error as Error)?.message ?? "Unknown error"}
          </p>
          <button
            onClick={() => roomQ.refetch()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      </AdminShell>
    );
  }

  if (!room) {
    return (
      <AdminShell>
        <BackLink />
        <div className="mt-6 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium">Room not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{roomId}</span> does not exist or has been removed.
          </p>
        </div>
      </AdminShell>
    );
  }

  const submitBan = async (b: { kind: string; reason?: string; expiresAt?: string | null }) => {
    if (!banTarget) return;
    await api.admin.banUser({
      userId: banTarget.userId,
      // @ts-expect-error mocked
      kind: b.kind,
      reason: b.reason,
      expiresAt: b.expiresAt,
    });
    toast.success(`${b.kind.replace("_", " ")} applied to ${banTarget.displayName}`);
  };

  return (
    <AdminShell>
      <BackLink />

      {/* Header */}
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{room.name}</h1>
            <Pill>
              {room.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {room.visibility}
            </Pill>
            <Pill tone="ok">active</Pill>
          </div>
          {room.description && <p className="mt-1 text-sm text-muted-foreground">{room.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{room.id}</span> · created {timeAgo(room.createdAt)} · last activity{" "}
            {timeAgo(room.lastActivityAt)}
          </p>
        </div>
        <button
          onClick={() => setRemoveOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20"
        >
          <Trash2 className="h-4 w-4" /> Remove room
        </button>
      </div>

      {/* Stats strip */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Participants" value={room.participantCount} />
        <Stat label="Messages (loaded)" value={messages.length} />
        <Stat label="Open reports" value={roomReports.filter((r) => r.status === "open").length} tone={roomReports.some(r=>r.status==="open") ? "warn" : "muted"} />
        <Stat label="Visibility" value={room.visibility} />
      </div>

      {/* Two-column layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <ReportsSection reports={roomReports} />
          <MessagesSection messages={messages} />
        </div>
        <div className="space-y-6">
          <InviteSection
            visibility={room.visibility}
            enabled={inviteEnabled}
            code={inviteCode}
            onToggle={() => setInviteEnabled((v) => !v)}
            onRegenerate={() => {
              setInviteCode(
                Math.random().toString(36).slice(2, 6).toUpperCase() +
                  "-" +
                  Math.random().toString(36).slice(2, 6).toUpperCase(),
              );
              toast.success("Invite regenerated");
            }}
          />
          <ParticipantsSection participants={participants} onBan={setBanTarget} />
        </div>
      </div>

      <BanActionDialog
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        onSubmit={submitBan}
        target={banTarget?.displayName ?? ""}
        defaultKind="room_ban"
      />

      <ConfirmRemoveDialog
        open={removeOpen}
        roomName={room.name}
        onClose={() => setRemoveOpen(false)}
        onConfirm={async () => {
          await api.admin.removeRoom(room.id);
          toast.success(`Removed "${room.name}"`);
          navigate({ to: "/admin/rooms" });
        }}
      />
    </AdminShell>
  );
}

// ── Building blocks ──────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      to="/admin/rooms"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to rooms
    </Link>
  );
}

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "ok" | "warn" }) {
  const map = {
    default: "border-border text-muted-foreground",
    ok: "border-emerald-500/30 text-emerald-500",
    warn: "border-amber-500/30 text-amber-500",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase ${map[tone]}`}>
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "muted" | "warn";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${tone === "warn" ? "text-amber-500" : ""}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-medium">{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReportsSection({ reports }: { reports: Report[] }) {
  return (
    <Section
      title="Room reports"
      action={<span className="text-xs text-muted-foreground">{reports.length} total</span>}
    >
      {reports.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">No reports for this room.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Reason</th>
              <th className="px-3 py-2 text-left font-medium">Target</th>
              <th className="px-3 py-2 text-left font-medium">When</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2.5">
                  <div className="text-sm">{r.reason}</div>
                  {r.context?.messageContent && (
                    <div className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground">
                      "{r.context.messageContent}"
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <span className="uppercase text-muted-foreground">{r.targetType}</span>
                  {r.context?.displayName && <div className="text-sm">{r.context.displayName}</div>}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{timeAgo(r.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={
                      "text-[10px] uppercase " +
                      (r.status === "open"
                        ? "text-amber-500"
                        : r.status === "resolved"
                          ? "text-emerald-500"
                          : "text-muted-foreground")
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Link to="/admin/reports" className="text-xs text-primary hover:underline">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function MessagesSection({ messages }: { messages: { id: string; displayName: string; displayColor: string; content: string; createdAt: string }[] }) {
  const recent = messages.slice(-15).reverse();
  return (
    <Section title="Recent messages" action={<span className="text-xs text-muted-foreground">{messages.length} loaded</span>}>
      {recent.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">No recent messages.</div>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((m) => (
            <li key={m.id} className="px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.displayColor }} />
                <span className="font-medium" style={{ color: m.displayColor }}>
                  {m.displayName}
                </span>
                <span className="text-muted-foreground">{timeAgo(m.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm">{m.content}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ParticipantsSection({
  participants,
  onBan,
}: {
  participants: Participant[];
  onBan: (p: Participant) => void;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  return (
    <Section title="Participants" action={<span className="text-xs text-muted-foreground">{participants.length} seen</span>}>
      {participants.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">No participants observed.</div>
      ) : (
        <ul className="divide-y divide-border">
          {participants.map((p) => (
            <li key={p.userId} className="flex items-center justify-between px-4 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-background"
                  style={{ backgroundColor: p.displayColor }}
                >
                  {p.displayName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{p.displayName}</span>
                    {p.isRoomOwner && <Pill>owner</Pill>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.messageCount} msg · active {timeAgo(p.lastActiveAt)}
                  </div>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === p.userId ? null : p.userId)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                  aria-label="Moderation menu"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {openMenu === p.userId && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-popover text-sm shadow-lg">
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: p.userId }}
                        className="block px-3 py-2 hover:bg-accent"
                      >
                        View profile
                      </Link>
                      <button
                        onClick={() => {
                          setOpenMenu(null);
                          onBan(p);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-destructive hover:bg-accent"
                      >
                        <Ban className="h-3.5 w-3.5" /> Ban from room
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function InviteSection({
  visibility,
  enabled,
  code,
  onToggle,
  onRegenerate,
}: {
  visibility: "public" | "private";
  enabled: boolean;
  code: string;
  onToggle: () => void;
  onRegenerate: () => void;
}) {
  if (visibility === "public") {
    return (
      <Section title="Invite & sharing">
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" /> Public room · open to any verified campus user. No invite required.
        </div>
      </Section>
    );
  }
  return (
    <Section
      title="Invite & sharing"
      action={
        <span className={"text-[10px] uppercase " + (enabled ? "text-emerald-500" : "text-muted-foreground")}>
          {enabled ? "enabled" : "disabled"}
        </span>
      }
    >
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
            {code}
          </code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(code);
              toast.success("Copied");
            }}
            className="rounded-md border border-border p-1.5 hover:bg-accent"
            aria-label="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            <RefreshCw className="h-3 w-3" /> Regenerate
          </button>
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            <ShieldOff className="h-3 w-3" /> {enabled ? "Disable invite" : "Enable invite"}
          </button>
        </div>
      </div>
    </Section>
  );
}

function ConfirmRemoveDialog({
  open,
  roomName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  roomName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) {
      setState("idle");
      setErr(null);
      setTyped("");
    }
  }, [open]);

  if (!open) return null;
  const canConfirm = typed.trim() === roomName && state !== "loading";

  const run = async () => {
    setState("loading");
    setErr(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setState("error");
      setErr((e as Error)?.message ?? "Failed to remove room");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={state === "loading" ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Remove room</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              This removes <span className="font-medium text-foreground">{roomName}</span> and detaches all participants.
            </p>
          </div>
          <button onClick={onClose} disabled={state === "loading"} className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">
            Type <span className="font-mono text-foreground">{roomName}</span> to confirm
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
        {err && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {err}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={state === "loading"}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={run}
            disabled={!canConfirm}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            {state === "loading" ? "Removing…" : <><Trash2 className="h-4 w-4" /> Remove room</>}
          </button>
        </div>
      </div>
    </div>
  );
}
