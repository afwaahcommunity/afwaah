import { CAMPUS_ROOM_BY_ID, CAMPUS_ROOMS } from "../data/rooms";
import type { CampusRoom, FloorId } from "../types";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getRoom(roomId: string | null | undefined) {
  if (!roomId) return null;
  return CAMPUS_ROOM_BY_ID[roomId] ?? null;
}

export function searchRooms(query: string, floor?: FloorId, limit = 8): CampusRoom[] {
  const normalized = normalize(query);
  if (!normalized) return [];

  const directMatch = CAMPUS_ROOM_BY_ID[normalized];
  const rooms = floor
    ? CAMPUS_ROOMS.filter((room) => room.floor === floor)
    : CAMPUS_ROOMS;

  const scored = rooms
    .map((room) => {
      let score = 0;
      const name = normalize(room.name);
      const details = normalize(room.details);

      if (room.id === normalized) score += 100;
      if (name === normalized) score += 80;
      if (name.startsWith(normalized)) score += 40;
      if (details.startsWith(normalized)) score += 24;
      if (name.includes(normalized)) score += 18;
      if (details.includes(normalized)) score += 10;
      if (room.keywords.some((keyword) => keyword === normalized)) score += 14;
      if (room.keywords.some((keyword) => keyword.startsWith(normalized))) score += 6;

      return { room, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(a.room.id) - Number(b.room.id))
    .map(({ room }) => room);

  if (directMatch && (!floor || directMatch.floor === floor)) {
    return [directMatch, ...scored.filter((room) => room.id !== directMatch.id)].slice(0, limit);
  }

  return scored.slice(0, limit);
}
