import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Room } from "@/lib/types";

type State = "idle" | "loading" | "success" | "error";

export function LeaveRoomDialog({
  open,
  room,
  onClose,
}: {
  open: boolean;
  room: Room | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setState("idle");
      setError(null);
    }
  }, [open, room?.id]);

  if (!open || !room) return null;

  const confirm = async () => {
    setState("loading");
    setError(null);
    try {
      await api.rooms.leave(room.id);
      setState("success");
      setTimeout(() => {
        onClose();
        router.push("/rooms");
      }, 500);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Couldn't leave. Try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={state === "loading" ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Leave room?</h2>
              <p className="text-[11px] text-muted-foreground">You can rejoin from the rooms list.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={state === "loading"}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Room</span>
            <div className="mt-0.5 font-medium text-foreground">#{room.name}</div>
          </div>
          {state === "error" && error && (
            <p className="mt-2 text-[11px] text-destructive">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <button
            onClick={onClose}
            disabled={state === "loading"}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={state === "loading" || state === "success"}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-70"
          >
            {state === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
            {state === "success" && <Check className="h-3 w-3" />}
            {state === "idle" && "Leave room"}
            {state === "loading" && "Leaving…"}
            {state === "success" && "Left"}
            {state === "error" && "Try again"}
          </button>
        </div>
      </div>
    </div>
  );
}
