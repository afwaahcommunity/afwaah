import { useEffect, useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import type { Message, ReportReason } from "@/lib/types";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "spam", label: "Spam" },
  { value: "hate", label: "Hate or discrimination" },
  { value: "threat", label: "Threat or unsafe behavior" },
  { value: "sexual", label: "Sexual content" },
  { value: "personal_info", label: "Personal information" },
  { value: "off_topic", label: "Off-topic disruption" },
  { value: "other", label: "Other" },
];

export function ReportDialog({
  open,
  onClose,
  message,
  roomName,
  reporterId,
  restricted,
}: {
  open: boolean;
  onClose: () => void;
  message: Message | null;
  roomName?: string;
  reporterId?: string;
  restricted?: { title: string; description: string } | null;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, message?.id]);

  if (!open || !message) return null;

  const detailsRequired = reason === "other";
  const detailsTooLong = details.length > 500;
  const canSubmit =
    !!reason &&
    !submitting &&
    !detailsTooLong &&
    (!detailsRequired || details.trim().length >= 3) &&
    !restricted;

  const submit = async () => {
    if (!canSubmit || !reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.reports.create({
        targetType: "message",
        targetId: message.id,
        roomId: message.roomId,
        reportedUserId: message.userId,
        reporterId,
        reason,
        details: details.trim() || undefined,
        context: {
          messageContent: message.content.slice(0, 240),
          roomName,
          displayName: message.displayName,
          displayColor: message.displayColor,
        },
      });
      toast.success("Report sent to moderators");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not submit report";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-popover shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Report message</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tell moderators what is wrong with this message.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {/* Message context */}
          <div className="rounded-md border border-border bg-muted/30 p-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: message.displayColor }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: message.displayColor }}
              >
                {message.displayName}
              </span>
              {roomName && (
                <span className="text-[10px] text-muted-foreground">· in #{roomName}</span>
              )}
            </div>
            <p
              className="mt-1 text-xs text-foreground/90"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {message.content}
            </p>
          </div>

          {restricted ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                style={{ color: "var(--warning)" }}
              />
              <div>
                <div className="font-medium" style={{ color: "var(--warning)" }}>
                  {restricted.title}
                </div>
                <div className="mt-0.5 text-muted-foreground">{restricted.description}</div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Reason <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {REASONS.map((r) => {
                    const active = reason === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setReason(r.value)}
                        className={
                          "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors " +
                          (active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")
                        }
                        aria-pressed={active}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Details{" "}
                  <span className="text-muted-foreground">
                    {detailsRequired ? "(required)" : "(optional)"}
                  </span>
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={
                    detailsRequired
                      ? "Briefly describe the issue"
                      : "Add anything moderators should know"
                  }
                  className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{error && <span className="text-destructive">{error}</span>}</span>
                  <span>{details.length}/500</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          {!restricted && (
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              {submitting ? "Sending..." : "Submit report"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
