import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import {
  Ban,
  ShieldAlert,
  Clock,
  MapPin,
  Timer,
  Check,
  X,
  ShieldCheck,
  Eye,
  DoorClosed,
  LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/blocked")({
  head: () => ({
    meta: [
      { title: "Access status — campus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Blocked,
});

type StateKey =
  | "clear"
  | "off_campus"
  | "read_only"
  | "quarantine"
  | "room_ban"
  | "hard"
  | "rate_limited";

interface Details {
  icon: LucideIcon;
  tone: "ok" | "warn" | "block";
  title: string;
  summary: string;
  can: string[];
  cannot: string[];
  primary: {
    label: string;
    to?: "/rooms" | "/verify-location";
    kind?: "wait" | "contact";
  };
  expiresAt?: string | null;
}

const STATE_LABELS: Record<StateKey, string> = {
  clear: "Clear",
  off_campus: "Off-campus",
  read_only: "Read-only",
  quarantine: "Quarantine",
  room_ban: "Room ban",
  hard: "Hard ban",
  rate_limited: "Rate limited",
};

const STATE_ORDER: StateKey[] = [
  "clear",
  "off_campus",
  "read_only",
  "quarantine",
  "room_ban",
  "rate_limited",
  "hard",
];

const IS_DEV = import.meta.env.DEV;

function Blocked() {
  const { session } = useSession();

  const actual: StateKey = useMemo(() => {
    const kind = session?.ban?.kind;
    if (kind === "hard") return "hard";
    if (kind === "read_only") return "read_only";
    if (kind === "quarantine") return "quarantine";
    if (kind === "room_ban") return "room_ban";
    if (kind === "rate_limited") return "rate_limited";
    if (session?.writeAccess.kind === "off_campus") return "off_campus";
    return "clear";
  }, [session]);

  const [preview, setPreview] = useState<StateKey | null>(null);
  const active: StateKey = preview ?? actual;
  const details = describe(active, session?.ban?.expiresAt ?? null);
  const Icon = details.icon;

  const toneRing =
    details.tone === "ok"
      ? "ring-emerald-500/20 bg-emerald-500/10 text-emerald-500"
      : details.tone === "warn"
      ? "ring-amber-500/20 bg-amber-500/10 text-amber-500"
      : "ring-destructive/20 bg-destructive/10 text-destructive";

  const toneDot =
    details.tone === "ok"
      ? "bg-emerald-500"
      : details.tone === "warn"
      ? "bg-amber-500"
      : "bg-destructive";

  return (
    <AppShell maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Access status</h1>
            <p className="text-xs text-muted-foreground">
              A calm overview of what you can do right now.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${toneDot}`} />
            {STATE_LABELS[active]}
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 ${toneRing}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">{details.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{details.summary}</p>
              {session?.ban?.reason && preview === null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="text-foreground/80">Reason:</span> {session.ban.reason}
                </p>
              )}
              {details.expiresAt && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  Expires {new Date(details.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                You can
              </div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {details.can.length === 0 ? (
                  <li className="text-muted-foreground">—</li>
                ) : (
                  details.can.map((c) => (
                    <li key={c} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                      <span>{c}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                You cannot
              </div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {details.cannot.length === 0 ? (
                  <li className="text-muted-foreground">Nothing</li>
                ) : (
                  details.cannot.map((c) => (
                    <li key={c} className="flex items-start gap-2">
                      <X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                      <span>{c}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <PrimaryAction primary={details.primary} />
          </div>
        </div>

        {IS_DEV && (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Preview state (dev)
              </div>
              {preview !== null && (
                <button
                  onClick={() => setPreview(null)}
                  className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  reset to actual
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {STATE_ORDER.map((s) => {
                const on = active === s;
                return (
                  <button
                    key={s}
                    onClick={() => setPreview(s === actual ? null : s)}
                    className={
                      "rounded-md border px-2 py-1 text-[11px] transition-colors " +
                      (on
                        ? "border-foreground/40 bg-foreground/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
                    }
                  >
                    {STATE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PrimaryAction({ primary }: { primary: Details["primary"] }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90";
  if (primary.kind === "wait") {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
      >
        <Clock className="h-3.5 w-3.5" /> {primary.label}
      </button>
    );
  }
  if (primary.kind === "contact") {
    return (
      <a
        href="mailto:moderation@campus.example"
        className={`${base} border border-border text-foreground hover:bg-accent`}
      >
        {primary.label}
      </a>
    );
  }
  return (
    <Link to={primary.to ?? "/rooms"} className={`${base} bg-primary text-primary-foreground`}>
      {primary.label}
    </Link>
  );
}

function describe(state: StateKey, expiresAt: string | null): Details {
  switch (state) {
    case "clear":
      return {
        icon: ShieldCheck,
        tone: "ok",
        title: "Nothing restricted",
        summary: "Full access. Browse, send, react, and create rooms as usual.",
        can: ["Browse rooms", "Send messages", "React and report", "Create rooms"],
        cannot: [],
        primary: { label: "Back to rooms", to: "/rooms" },
      };
    case "off_campus":
      return {
        icon: MapPin,
        tone: "warn",
        title: "Off-campus — read only",
        summary: "You're outside the verified campus area. Reading stays open; sending unlocks on campus.",
        can: ["Browse rooms", "Read messages", "See presence"],
        cannot: ["Send messages", "React", "Create rooms"],
        primary: { label: "Verify location", to: "/verify-location" },
      };
    case "read_only":
      return {
        icon: Eye,
        tone: "warn",
        title: "Read-only ban",
        summary: "A moderator restricted writes on your account. You can still read everything.",
        can: ["Browse and join rooms", "Read messages"],
        cannot: ["Send messages", "React", "Report", "Edit or delete", "Create rooms"],
        expiresAt,
        primary: expiresAt
          ? { label: "Waiting on expiry", kind: "wait" }
          : { label: "Contact moderation", kind: "contact" },
      };
    case "quarantine":
      return {
        icon: ShieldAlert,
        tone: "warn",
        title: "Quarantine",
        summary: "Your account is under review. Reading works; writing is paused while a moderator looks.",
        can: ["Browse rooms", "Read messages"],
        cannot: ["Send messages", "React", "Report", "Create rooms"],
        expiresAt,
        primary: { label: "Contact moderation", kind: "contact" },
      };
    case "room_ban":
      return {
        icon: DoorClosed,
        tone: "warn",
        title: "Banned from a room",
        summary: "You can't read or join this specific room. Every other room stays available.",
        can: ["Use all other rooms", "Send messages elsewhere"],
        cannot: ["Read the banned room", "Rejoin the banned room"],
        expiresAt,
        primary: { label: "Back to rooms", to: "/rooms" },
      };
    case "hard":
      return {
        icon: Ban,
        tone: "block",
        title: "Hard ban",
        summary: "Access to campus chat is fully suspended until the ban expires.",
        can: [],
        cannot: ["Browse", "Read", "Send", "React", "Create rooms"],
        expiresAt,
        primary: expiresAt
          ? { label: "Waiting on expiry", kind: "wait" }
          : { label: "Contact moderation", kind: "contact" },
      };
    case "rate_limited":
      return {
        icon: Clock,
        tone: "warn",
        title: "Rate limited",
        summary: "You've been sending a lot quickly. Take a short breather, then try again.",
        can: ["Browse rooms", "Read messages"],
        cannot: ["Send new messages briefly"],
        primary: { label: "Waiting for cooldown", kind: "wait" },
      };
  }
}
