export function normalizeRoomName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function createRoomSlug(name: string): string {
  return normalizeRoomName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function validateRoomName(name: string): string | null {
  const normalized = normalizeRoomName(name);

  if (normalized.length < 2) {
    return "Room name is too short.";
  }

  if (normalized.length > 100) {
    return "Room name is too long.";
  }

  return null;
}
