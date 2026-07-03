import type {
  AdminOverview,
  AdminUser,
  GeofenceSettings,
  Message,
  Report,
  Room,
} from "../types";

const now = Date.now();
const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

export const mockRooms: Room[] = [
  {
    id: "r_general",
    name: "general",
    description: "campus-wide chatter",
    visibility: "public",
    participantCount: 42,
    lastActivityAt: iso(1000 * 60 * 2),
    createdBy: "u_1",
    createdAt: iso(1000 * 60 * 60 * 24 * 30),
  },
  {
    id: "r_library",
    name: "library-3rd-floor",
    description: "quiet hours only",
    visibility: "public",
    participantCount: 8,
    lastActivityAt: iso(1000 * 60 * 12),
    createdBy: "u_2",
    createdAt: iso(1000 * 60 * 60 * 24 * 7),
  },
  {
    id: "r_late",
    name: "late-night-diner",
    description: "who's up at 2am",
    visibility: "public",
    participantCount: 17,
    lastActivityAt: iso(1000 * 60 * 40),
    createdBy: "u_3",
    createdAt: iso(1000 * 60 * 60 * 24 * 3),
  },
  {
    id: "r_thesis",
    name: "thesis-support-group",
    visibility: "private",
    participantCount: 5,
    lastActivityAt: iso(1000 * 60 * 60 * 6),
    createdBy: "me",
    createdAt: iso(1000 * 60 * 60 * 24 * 2),
    createdByMe: true,
  },
  {
    id: "r_lost",
    name: "lost-and-found",
    description: "did anyone see a blue backpack",
    visibility: "public",
    participantCount: 3,
    lastActivityAt: iso(1000 * 60 * 60 * 26),
    createdBy: "u_4",
    createdAt: iso(1000 * 60 * 60 * 24 * 5),
  },
];

export const mockMessages: Message[] = [
  {
    id: "m1",
    roomId: "r_general",
    userId: "u_a",
    displayName: "quiet-otter-42",
    displayColor: "#22d3ee",
    content: "anyone know if the north cafe is open on sunday?",
    createdAt: iso(1000 * 60 * 30),
    reactions: { "👀": 2 },
    myReactions: [],
  },
  {
    id: "m2",
    roomId: "r_general",
    userId: "u_b",
    displayName: "brave-heron-08",
    displayColor: "#f472b6",
    content: "closed till 10am",
    createdAt: iso(1000 * 60 * 28),
    reactions: {},
    myReactions: [],
  },
  {
    id: "m3",
    roomId: "r_general",
    userId: "u_c",
    displayName: "amber-koi-77",
    displayColor: "#fbbf24",
    content: "the espresso there is genuinely criminal though",
    createdAt: iso(1000 * 60 * 26),
    reactions: { "😂": 4, "💯": 1 },
    myReactions: ["😂"],
  },
  {
    id: "m4",
    roomId: "r_general",
    userId: "me",
    displayName: "silent-willow-31",
    displayColor: "#60a5fa",
    content: "i'll try the one by the engineering building instead",
    createdAt: iso(1000 * 60 * 20),
    reactions: {},
    myReactions: [],
    isMine: true,
  },
  {
    id: "m5",
    roomId: "r_general",
    userId: "u_a",
    displayName: "quiet-otter-42",
    displayColor: "#22d3ee",
    content: "smart",
    createdAt: iso(1000 * 60 * 3),
    reactions: {},
    myReactions: [],
  },
  {
    id: "m6",
    roomId: "r_late",
    userId: "u_x",
    displayName: "cinder-atlas-04",
    displayColor: "#fb923c",
    content: "sell cheap textbooks dm me now, huge discount, act fast",
    createdAt: iso(1000 * 60 * 45),
    reactions: {},
    myReactions: [],
  },
  {
    id: "m7",
    roomId: "r_general",
    userId: "u_x",
    displayName: "cinder-atlas-04",
    displayColor: "#fb923c",
    content: "check my link in bio for the crypto giveaway 🚀",
    createdAt: iso(1000 * 60 * 60 * 2),
    reactions: {},
    myReactions: [],
  },
  {
    id: "m8",
    roomId: "r_lost",
    userId: "u_x",
    displayName: "cinder-atlas-04",
    displayColor: "#fb923c",
    content: "same offer here, don't miss out",
    createdAt: iso(1000 * 60 * 60 * 5),
    reactions: {},
    myReactions: [],
  },
];

export const mockReports: Report[] = [
  {
    id: "rep_1",
    targetType: "message",
    targetId: "m9",
    reason: "harassment",
    status: "open",
    createdAt: iso(1000 * 60 * 15),
    context: {
      messageContent: "you're such a [redacted]",
      roomName: "general",
      displayName: "wild-fox-11",
    },
  },
  {
    id: "rep_2",
    targetType: "user",
    targetId: "u_x",
    reason: "spam",
    status: "open",
    createdAt: iso(1000 * 60 * 60 * 2),
    reportedUserId: "u_x",
    context: { displayName: "cinder-atlas-04" },
  },
  {
    id: "rep_4",
    targetType: "message",
    targetId: "m6",
    reason: "spam",
    details: "Selling textbooks in chat, third time this week.",
    status: "open",
    createdAt: iso(1000 * 60 * 30),
    reporterId: "u_a",
    reportedUserId: "u_x",
    roomId: "r_late",
    context: {
      messageContent: "sell cheap textbooks dm me now, huge discount, act fast",
      roomName: "late-night-diner",
      displayName: "cinder-atlas-04",
      displayColor: "#fb923c",
    },
  },
  {
    id: "rep_5",
    targetType: "message",
    targetId: "m7",
    reason: "spam",
    status: "resolved",
    createdAt: iso(1000 * 60 * 60 * 3),
    reporterId: "u_b",
    reportedUserId: "u_x",
    roomId: "r_general",
    context: {
      messageContent: "check my link in bio for the crypto giveaway 🚀",
      roomName: "general",
      displayName: "cinder-atlas-04",
      displayColor: "#fb923c",
    },
  },
  {
    id: "rep_3",
    targetType: "room",
    targetId: "r_bad",
    reason: "off-topic room",
    status: "resolved",
    createdAt: iso(1000 * 60 * 60 * 24),
    context: { roomName: "not-a-real-room" },
  },
];

export const mockAdminUsers: AdminUser[] = [
  {
    id: "u_x",
    displayName: "cinder-atlas-04",
    displayColor: "#fb923c",
    createdAt: iso(1000 * 60 * 60 * 24 * 4),
    lastSeenAt: iso(1000 * 60 * 6),
    reportCount: 3,
    banHistory: [
      {
        kind: "read_only",
        reason: "Repeat spam in #general",
        expiresAt: iso(-1000 * 60 * 60 * 24),
      },
    ],
    currentBan: null,
  },
];

export const mockOverview: AdminOverview = {
  openReports: 2,
  activeBans: 1,
  flaggedUsers: mockAdminUsers,
  recentRooms: mockRooms.slice(0, 3),
  recentActions: [
    {
      id: "a1",
      action: "read-only ban",
      target: "wild-fox-11",
      admin: "admin",
      at: iso(1000 * 60 * 22),
    },
    {
      id: "a2",
      action: "resolved report",
      target: "rep_3",
      admin: "admin",
      at: iso(1000 * 60 * 60 * 24),
    },
    {
      id: "a3",
      action: "room removed",
      target: "not-a-real-room",
      admin: "admin",
      at: iso(1000 * 60 * 60 * 26),
    },
  ],
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
