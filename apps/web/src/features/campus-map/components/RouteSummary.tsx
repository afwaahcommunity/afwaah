"use client";

import { AlertCircle, Route } from "lucide-react";
import { getFloorLabel } from "../engine";
import type { CampusRoom, RouteResult } from "../types";

export function RouteSummary({
  from,
  route,
  to,
}: {
  from: CampusRoom | null;
  route: RouteResult | null;
  to: CampusRoom | null;
}) {
  if (!from || !to) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Route className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Route</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a current room and a destination to draw the path.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Route summary</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {getFloorLabel(from.floor)}
            {route?.crossFloor ? ` to ${getFloorLabel(to.floor)}` : ""}
          </p>
        </div>
        {route?.crossFloor ? (
          <span className="rounded-md border border-warning/35 bg-warning/10 px-2 py-1 text-[11px] text-warning">
            floor change
          </span>
        ) : null}
      </div>

      {route?.warning ? (
        <div className="mb-3 flex gap-2 rounded-md border border-warning/25 bg-warning/10 p-2 text-xs text-warning">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{route.warning}</span>
        </div>
      ) : null}

      <ol className="space-y-2">
        {(route?.steps ?? []).map((step, index) => (
          <li key={`${step.floor}-${index}`} className="flex gap-2 text-sm">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">
              {index + 1}
            </span>
            <span className="text-muted-foreground">{step.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
