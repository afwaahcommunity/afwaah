"use client";

import { ArrowRight, LocateFixed } from "lucide-react";
import { getFloorLabel } from "../engine";
import type { CampusRoom } from "../types";

export function RoomInfoPanel({
  onSetFrom,
  onSetTo,
  room,
}: {
  onSetFrom: (roomId: string) => void;
  onSetTo: (roomId: string) => void;
  room: CampusRoom | null;
}) {
  if (!room) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Room info</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click a room on the map or search by room name/id.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{room.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {room.details || getFloorLabel(room.floor)}
          </p>
        </div>
        <span className="flex-shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
          {room.id}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-border bg-background p-2">
          <p className="uppercase tracking-wide text-muted-foreground">Floor</p>
          <p className="mt-1 font-medium">{getFloorLabel(room.floor)}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-2">
          <p className="uppercase tracking-wide text-muted-foreground">Type</p>
          <p className="mt-1 capitalize">{room.type}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSetFrom(room.id)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LocateFixed className="h-4 w-4" />
          Start
        </button>
        <button
          type="button"
          onClick={() => onSetTo(room.id)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <ArrowRight className="h-4 w-4" />
          Destination
        </button>
      </div>
    </section>
  );
}
