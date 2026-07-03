import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { api } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";

export function ShareRoomModal({
  roomId,
  open,
  onClose,
}: {
  roomId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["invite", roomId],
    queryFn: () => api.rooms.createInvite(roomId),
    enabled: open,
  });

  if (!open) return null;

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Share this room</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Anyone with this link can join.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-md border border-border bg-background p-3">
          {isLoading || !data ? (
            <div className="h-5 w-full animate-pulse rounded bg-muted" />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <code className="truncate text-xs font-mono text-muted-foreground">{data.url}</code>
              <button
                onClick={copy}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>

        {data && (
          <p className="mt-3 text-xs text-muted-foreground">
            Invite code: <span className="font-mono text-foreground">{data.code}</span>
          </p>
        )}
      </div>
    </div>
  );
}
