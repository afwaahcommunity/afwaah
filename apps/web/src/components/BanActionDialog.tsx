import { useState } from "react";
import { X } from "lucide-react";
import type { BanState, BanKind } from "@/lib/types";

const KIND_OPTIONS: { kind: BanKind; label: string; hint: string }[] = [
  { kind: "read_only", label: "Read-only ban", hint: "Can browse; cannot send." },
  { kind: "hard", label: "Hard ban", hint: "Blocked from campus chat." },
  { kind: "quarantine", label: "Quarantine", hint: "Account under review." },
  { kind: "room_ban", label: "Room ban", hint: "Removed from specific room." },
];

export function BanActionDialog({
  open,
  onClose,
  onSubmit,
  target,
  defaultKind = "read_only",
  allowedKinds,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (b: Omit<BanState, "roomId"> & { roomId?: string }) => Promise<void> | void;
  target: string;
  defaultKind?: BanKind;
  allowedKinds?: BanKind[];
}) {
  const options = allowedKinds
    ? KIND_OPTIONS.filter((o) => allowedKinds.includes(o.kind))
    : KIND_OPTIONS;
  const [kind, setKind] = useState<BanKind>(defaultKind);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("24h");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canSubmit = reason.trim().length >= 3 && !submitting;

  const submit = async () => {
    if (!canSubmit) {
      setError("Reason is required (min 3 characters).");
      return;
    }
    setSubmitting(true);
    setError(null);
    const expiresAt =
      duration === "permanent"
        ? null
        : new Date(Date.now() + (duration === "1h" ? 3600e3 : duration === "24h" ? 86400e3 : 7 * 86400e3)).toISOString();
    try {
      await onSubmit({ kind, reason: reason.trim(), expiresAt });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Moderate {target}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose the action and duration.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {options.map((o) => {
            const active = kind === o.kind;
            return (
              <button
                key={o.kind}
                type="button"
                onClick={() => setKind(o.kind)}
                className={
                  "w-full rounded-md border px-3 py-2 text-left transition-colors " +
                  (active
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent")
                }
              >
                <div className="text-sm font-medium">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.hint}</div>
              </button>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-muted-foreground">
            Reason <span className="text-destructive">*</span>
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required — short internal note"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
        </label>

        <div className="mt-3">
          <span className="text-xs font-medium text-muted-foreground">Duration</span>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {(["1h", "24h", "7d", "permanent"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={
                  "rounded-md border px-2 py-1.5 text-xs transition-colors " +
                  (duration === d
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent")
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
