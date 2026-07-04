import type { FloorId, LegacyFloorId } from "../types";

export const FLOORS = [
  { id: "ground", legacyId: "0", label: "Ground", shortLabel: "G" },
  { id: "first", legacyId: "1", label: "First", shortLabel: "1" },
  { id: "second", legacyId: "2", label: "Second", shortLabel: "2" },
  { id: "backside", legacyId: "3", label: "Backside", shortLabel: "B" },
] as const;

export const FLOOR_BY_ID = Object.fromEntries(FLOORS.map((floor) => [floor.id, floor])) as Record<FloorId, (typeof FLOORS)[number]>;

export const FLOOR_BY_LEGACY_ID = Object.fromEntries(FLOORS.map((floor) => [floor.legacyId, floor])) as Record<LegacyFloorId, (typeof FLOORS)[number]>;
