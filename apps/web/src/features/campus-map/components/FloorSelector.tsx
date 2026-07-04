"use client";

import { FLOORS } from "../data/floors";
import type { FloorId, RouteResult } from "../types";

export function FloorSelector({
  floor,
  onChange,
  route,
}: {
  floor: FloorId;
  onChange: (floor: FloorId) => void;
  route: RouteResult | null;
}) {
  return (
    <div className="mx-auto flex w-fit max-w-full min-w-0 gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 lg:mx-0">
      {FLOORS.map((item) => {
        const involved = route?.floorsInvolved.includes(item.id);
        const active = item.id === floor;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={
              "relative rounded-md px-3 py-1.5 text-sm transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground")
            }
          >
            {item.label}
            {involved && !active ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
