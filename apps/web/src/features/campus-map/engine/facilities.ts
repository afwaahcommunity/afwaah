import { LEGACY_SERVICES } from "../data/services";
import { CAMPUS_ROOM_BY_ID } from "../data/rooms";
import type { CampusRoom, FacilityType, GeometryIndex, LegacyServiceKey } from "../types";
import { distanceBetween, pointForId } from "./geometry";
import { calculateSameFloorRoute } from "./routing";

export const FACILITY_OPTIONS = [
  { label: "Stairs", type: "stairs" },
  { label: "Lift / water", type: "lift" },
  { label: "Ladies toilet", type: "ladies_toilet" },
  { label: "Gents toilet", type: "gents_toilet" },
  { label: "Gate", type: "gate" },
  { label: "Backside", type: "backside" },
] as const satisfies { label: string; type: FacilityType }[];

const SERVICE_BY_FACILITY: Record<FacilityType, LegacyServiceKey> = {
  backside: "B",
  gate: "G",
  gents_toilet: "GT",
  ladies_toilet: "LT",
  lift: "L",
  stairs: "S",
};

function serviceCandidates(source: CampusRoom, facility: FacilityType) {
  const serviceKey = SERVICE_BY_FACILITY[facility];
  const floorServices = LEGACY_SERVICES[serviceKey]?.[source.legacyFloor];
  if (!floorServices) return [];

  return Object.values(floorServices)
    .flat()
    .map((id) => CAMPUS_ROOM_BY_ID[id])
    .filter(Boolean) as CampusRoom[];
}

export function findNearestFacilityRoute(
  sourceId: string | null,
  facility: FacilityType,
  geometry: GeometryIndex | null,
) {
  const source = sourceId ? CAMPUS_ROOM_BY_ID[sourceId] : null;
  if (!source || !geometry) return null;

  const sourcePoint = pointForId(geometry, source.id);
  const candidates = serviceCandidates(source, facility).filter((room) => room.floor === source.floor);
  if (!sourcePoint || !candidates.length) return null;

  const ranked = candidates
    .map((room) => {
      const route = calculateSameFloorRoute(source.id, room.id, source.floor, source.legacyFloor, geometry);
      const destinationPoint = pointForId(geometry, room.id);

      return {
        room,
        route,
        score: route?.distance ?? (destinationPoint ? distanceBetween(sourcePoint, destinationPoint) : Number.MAX_SAFE_INTEGER),
      };
    })
    .sort((a, b) => a.score - b.score);

  return ranked[0] ?? null;
}
