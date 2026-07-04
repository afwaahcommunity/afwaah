import { FLOOR_BY_ID, FLOOR_BY_LEGACY_ID } from "../data/floors";
import type { CampusRoom, FloorId, LegacyFloorId } from "../types";

export function detectFloorByRoomId(roomId: string): FloorId {
  const numericId = Number(roomId);

  if (numericId >= 303) return "backside";
  if (numericId >= 205 && numericId <= 302) return "first";
  if (numericId >= 115 && numericId <= 204) return "second";
  return "ground";
}

export function getFloorLabel(floor: FloorId) {
  return FLOOR_BY_ID[floor].label;
}

export function getFloorShortLabel(floor: FloorId) {
  return FLOOR_BY_ID[floor].shortLabel;
}

export function legacyFloorToFloor(legacyFloor: LegacyFloorId) {
  return FLOOR_BY_LEGACY_ID[legacyFloor].id;
}

export function roomFloor(room: CampusRoom) {
  return room.floor;
}
