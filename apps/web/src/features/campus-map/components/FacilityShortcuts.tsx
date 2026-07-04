"use client";

import { DoorOpen, Droplets, Footprints, MapPin, MoveUp } from "lucide-react";
import { FACILITY_OPTIONS } from "../engine";
import type { FacilityType } from "../types";

const ICONS: Record<FacilityType, typeof Footprints> = {
  backside: DoorOpen,
  gate: DoorOpen,
  gents_toilet: MapPin,
  ladies_toilet: MapPin,
  lift: MoveUp,
  stairs: Footprints,
};

export function FacilityShortcuts({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (facility: FacilityType) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Nearest
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
        {FACILITY_OPTIONS.map((item) => {
          const Icon = item.type === "lift" ? Droplets : ICONS[item.type];
          return (
            <button
              key={item.type}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(item.type)}
              className="inline-flex min-w-0 items-center gap-2 rounded-md border border-border px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
