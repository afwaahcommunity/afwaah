import type { Report } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Check, X, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";

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
        <p className="mt-1 text-xs text-muted-foreground">The queue is empty.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
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
                <div className="text-xs uppercase text-muted-foreground">{r.targetType}</div>
                {r.context?.messageContent && (
                  <div className="mt-0.5 max-w-md truncate text-sm text-foreground">
                    "{r.context.messageContent}"
                  </div>
                )}
                {r.context?.displayName && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    by{" "}
                    {r.reportedUserId || r.targetType === "user" ? (
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: r.reportedUserId ?? r.targetId }}
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
                  <div className="mt-0.5 text-xs text-muted-foreground">in #{r.context.roomName}</div>
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
              <td className="px-3 py-3 text-xs text-muted-foreground">{timeAgo(r.createdAt)}</td>
              <td className="px-3 py-3">
                <span
                  className={
                    "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] uppercase " +
                    (r.status === "open"
                      ? "border-warning/40 text-warning"
                      : r.status === "resolved"
                      ? "border-success/40 text-success"
                      : "border-border text-muted-foreground")
                  }
                  style={
                    r.status === "open"
                      ? { color: "var(--warning)", borderColor: "color-mix(in oklab, var(--warning) 40%, transparent)" }
                      : r.status === "resolved"
                      ? { color: "var(--success)", borderColor: "color-mix(in oklab, var(--success) 40%, transparent)" }
                      : undefined
                  }
                >
                  {r.status}
                </span>
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
