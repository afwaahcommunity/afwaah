import Link from "next/link";
import { Lock, Users, Clock, Star } from "lucide-react";
import type { Room } from "@/lib/types";
import { timeAgo } from "@/lib/time";

export function RoomList({ rooms }: { rooms: Room[] }) {
  if (rooms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">No rooms match your search.</p>
        <p className="mt-1 text-xs text-muted-foreground">Try a different query or create a new one.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {rooms.map((r) => (
        <li key={r.id}>
          <Link
            href={`/rooms/${r.id}`}
            className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-accent/60"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{r.name}</span>
                {r.visibility === "private" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Lock className="h-3 w-3" /> private
                  </span>
                ) : (
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    public
                  </span>
                )}
                {r.createdByMe && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                    <Star className="h-3 w-3" /> yours
                  </span>
                )}
              </div>
              {r.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.description}</p>
              )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {r.participantCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {timeAgo(r.lastActivityAt)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
