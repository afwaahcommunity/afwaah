import type {
  AdminOverview,
  AdminUser,
  GeofenceSettings,
  Message,
  Report,
  Room,
} from "../types";

export const mockRooms: Room[] = [];

export const mockMessages: Message[] = [];

export const mockReports: Report[] = [];

export const mockAdminUsers: AdminUser[] = [];

export const mockOverview: AdminOverview = {
  openReports: 0,
  activeBans: 0,
  flaggedUsers: mockAdminUsers,
  recentRooms: [],
  recentActions: [],
};

export const mockGeofenceSettings: GeofenceSettings = {
  centerLatitude: 21.2497,
  centerLongitude: 81.6022,
  id: "geofence_default",
  name: "NIT Raipur Campus",
  radiusKm: 500,
  updatedAt: new Date().toISOString(),
};

export function mockGenerateMessage(roomId: string): Message {
  const names = [
    { n: "quiet-otter-42", c: "#22d3ee" },
    { n: "brave-heron-08", c: "#f472b6" },
    { n: "amber-koi-77", c: "#fbbf24" },
    { n: "wandering-moth-19", c: "#a3e635" },
  ];
  const p = names[Math.floor(Math.random() * names.length)];
  const lines = [
    "anyone else in the library rn",
    "the wifi is being weird",
    "printer on 2nd floor works fyi",
    "who scheduled a 8am final honestly",
    "spotted the campus cat by the fountain",
  ];
  return {
    id: `m_${Math.random().toString(36).slice(2, 9)}`,
    roomId,
    userId: `u_${Math.random().toString(36).slice(2, 6)}`,
    displayName: p?.n ?? "quiet-harbor-42",
    displayColor: p?.c ?? "#818cf8",
    content:
      lines[Math.floor(Math.random() * lines.length)] ??
      "the wifi is being weird",
    createdAt: new Date().toISOString(),
    reactions: {},
    myReactions: [],
  };
}
