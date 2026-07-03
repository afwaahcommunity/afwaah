import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Lock, Users, Clock, Star, Timer } from "lucide-react";
import type { Room } from "@/lib/types";
import { formatTimeLeft, millisUntil, timeAgo } from "@/lib/time";

const ROOM_EXPIRY_WARNING_MS = 15 * 60 * 1000;

export function RoomList({ rooms }: { rooms: Room[] }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!rooms.some((room) => room.expiresAt)) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [rooms]);

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
        <RoomListItem key={r.id} room={r} tick={tick} />
      ))}
    </ul>
  );
}

function RoomListItem({ room, tick }: { room: Room; tick: number }) {
  void tick;
  const msLeft = millisUntil(room.expiresAt);
  const expiresSoon =
    msLeft !== null && msLeft > 0 && msLeft <= ROOM_EXPIRY_WARNING_MS;

  return (
    <li>
      <Link
        href={`/rooms/${room.id}`}
        className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-accent/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{room.name}</span>
            {room.visibility === "private" ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3 w-3" /> private
              </span>
            ) : (
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                public
              </span>
            )}
            {room.createdByMe && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                <Star className="h-3 w-3" /> yours
              </span>
            )}
          </div>
          {room.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {room.description}
            </p>
          )}
          {expiresSoon && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              expires in {formatTimeLeft(msLeft)}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {room.participantCount}
          </span>
          {msLeft !== null && msLeft > ROOM_EXPIRY_WARNING_MS ? (
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3 w-3" /> {formatTimeLeft(msLeft)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {timeAgo(room.lastActivityAt)}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
