import type { Report } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Check, ExternalLink, ShieldAlert, X } from "lucide-react";
import Link from "next/link";

const REASON_LABELS: Record<string, string> = {
  harassment: "Harassment or abuse",
  spam: "Spam",
  hate: "Hate or discrimination",
  threat: "Threat or unsafe behavior",
  sexual: "Sexual content",
  personal_info: "Personal information",
  off_topic: "Off-topic disruption",
  other: "Other",
};
const labelFor = (r: string) => REASON_LABELS[r] ?? r;

export function ReportQueue({
  reports,
  onResolve,
  onDismiss,
  onBan,
}: {
  reports: Report[];
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  onBan: (r: Report) => void;
}) {
  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-sm text-foreground">Nothing to review</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The queue is empty.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="divide-y divide-border md:hidden">
        {reports.map((r) => (
          <article key={r.id} className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {r.targetType}
                  </span>
                  <StatusBadge status={r.status} />
                  <span className="text-[11px] text-muted-foreground">
                    {timeAgo(r.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {labelFor(r.reason)}
                </p>
              </div>
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            {r.context?.messageContent && (
              <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm leading-relaxed text-foreground">
                &quot;{r.context.messageContent}&quot;
              </p>
            )}

            <div className="space-y-1 text-xs text-muted-foreground">
              {r.context?.displayName && (
                <div className="flex min-w-0 items-center gap-1">
                  <span className="shrink-0">by</span>
                  {r.reportedUserId || r.targetType === "user" ? (
                    <Link
                      href={`/admin/users/${r.reportedUserId ?? r.targetId}`}
                      className="inline-flex min-w-0 items-center gap-0.5 text-primary hover:underline"
                    >
                      <span className="truncate">{r.context.displayName}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                  ) : (
                    <span className="truncate">{r.context.displayName}</span>
                  )}
                </div>
              )}
              {r.context?.roomName && <div>in #{r.context.roomName}</div>}
              {r.details && (
                <div className="line-clamp-2 pt-1 text-muted-foreground">
                  Note: {r.details}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={() => onResolve(r.id)}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border text-xs hover:bg-accent"
                title="Resolve"
              >
                <Check className="h-3.5 w-3.5" /> Resolve
              </button>
              <button
                onClick={() => onDismiss(r.id)}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border text-xs hover:bg-accent"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" /> Dismiss
              </button>
              <button
                onClick={() => onBan(r)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-destructive text-xs font-medium text-destructive-foreground hover:opacity-90"
              >
                Ban
              </button>
            </div>
          </article>
        ))}
      </div>

      <table className="hidden w-full text-sm md:table">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Target</th>
            <th className="px-3 py-2 text-left font-medium">Reason</th>
            <th className="px-3 py-2 text-left font-medium">When</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-3 py-3">
                <div className="text-xs uppercase text-muted-foreground">
                  {r.targetType}
                </div>
                {r.context?.messageContent && (
                  <div className="mt-0.5 max-w-md truncate text-sm text-foreground">
                    &quot;{r.context.messageContent}&quot;
                  </div>
                )}
                {r.context?.displayName && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    by{" "}
                    {r.reportedUserId || r.targetType === "user" ? (
                      <Link
                        href={`/admin/users/${r.reportedUserId ?? r.targetId}`}
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        {r.context.displayName}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span>{r.context.displayName}</span>
                    )}
                  </div>
                )}
                {r.context?.roomName && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    in #{r.context.roomName}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 text-sm">
                <div className="text-foreground">{labelFor(r.reason)}</div>
                {r.details && (
                  <div className="mt-0.5 max-w-xs text-xs text-muted-foreground line-clamp-2">
                    {r.details}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground">
                {timeAgo(r.createdAt)}
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-3 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => onResolve(r.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    title="Resolve"
                  >
                    <Check className="h-3.5 w-3.5" /> Resolve
                  </button>
                  <button
                    onClick={() => onDismiss(r.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" /> Dismiss
                  </button>
                  <button
                    onClick={() => onBan(r)}
                    className="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
                  >
                    Ban
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: Report["status"] }) {
  return (
    <span
      className={
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] uppercase " +
        (status === "open"
          ? "border-warning/40 text-warning"
          : status === "resolved"
            ? "border-success/40 text-success"
            : "border-border text-muted-foreground")
      }
      style={
        status === "open"
          ? {
              borderColor:
                "color-mix(in oklab, var(--warning) 40%, transparent)",
              color: "var(--warning)",
            }
          : status === "resolved"
            ? {
                borderColor:
                  "color-mix(in oklab, var(--success) 40%, transparent)",
                color: "var(--success)",
              }
            : undefined
      }
    >
      {status}
    </span>
  );
}
