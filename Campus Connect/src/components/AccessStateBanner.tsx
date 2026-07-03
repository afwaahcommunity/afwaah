import { Link } from "@tanstack/react-router";
import { AlertTriangle, MapPin, Ban, ShieldAlert, Clock } from "lucide-react";
import type { BanState, WriteAccessState } from "@/lib/types";

export function AccessStateBanner({
  ban,
  write,
}: {
  ban?: BanState | null;
  write?: WriteAccessState;
}) {
  if (ban) {
    const label =
      ban.kind === "hard" ? "You are banned from campus chat."
      : ban.kind === "read_only" ? "Read-only: you can browse but not send messages."
      : ban.kind === "quarantine" ? "Your account is under review."
      : ban.kind === "rate_limited" ? "You're sending messages too fast."
      : ban.kind === "room_ban" ? "You've been banned from this room."
      : "Access restricted.";
    const Icon = ban.kind === "hard" ? Ban : ban.kind === "quarantine" ? ShieldAlert : Clock;
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{label}</p>
          {ban.reason && <p className="mt-0.5 text-xs text-muted-foreground">{ban.reason}</p>}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            {ban.expiresAt && <span>Expires {new Date(ban.expiresAt).toLocaleString()}</span>}
            <Link to="/blocked" className="text-primary hover:underline">Details</Link>
          </div>
        </div>
      </div>
    );
  }

  if (write && write.kind !== "allowed") {
    const map: Record<string, { label: string; hint?: string }> = {
      off_campus: { label: "You're off campus — read-only mode.", hint: "Return to campus to send messages." },
      unverified: { label: "Verify location to send messages.", hint: "Reading is available everywhere." },
      denied: { label: "Location permission denied.", hint: "Enable location to unlock writing." },
      loading: { label: "Checking location…" },
      error: { label: "Location check failed.", hint: (write as { message?: string }).message },
    };
    const m = map[write.kind];
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
        {write.kind === "loading" ? (
          <span className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        ) : (
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-foreground">{m.label}</p>
          {m.hint && <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>}
          {write.kind !== "loading" && (
            <Link to="/verify-location" className="mt-1 inline-block text-xs text-primary hover:underline">
              Verify location →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function InlineWarning({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-warning/10 px-3 py-2 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--warning)" }} />
      <span className="text-foreground">{message}</span>
    </div>
  );
}
