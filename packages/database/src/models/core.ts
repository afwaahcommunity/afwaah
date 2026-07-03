import {
  anonymousSessions,
  anonymousUsers,
  displayNameHistory,
  geofenceConfig,
  locationChecks,
  messageReactions,
  messages,
  rateLimitConfig,
  roomParticipants,
  rooms,
} from "../schema/core";

export type AnonymousUser = typeof anonymousUsers.$inferSelect;
export type NewAnonymousUser = typeof anonymousUsers.$inferInsert;

export type AnonymousSession = typeof anonymousSessions.$inferSelect;
export type NewAnonymousSession = typeof anonymousSessions.$inferInsert;

export type DisplayNameHistory = typeof displayNameHistory.$inferSelect;
export type NewDisplayNameHistory = typeof displayNameHistory.$inferInsert;

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type RoomParticipant = typeof roomParticipants.$inferSelect;
export type NewRoomParticipant = typeof roomParticipants.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type MessageReaction = typeof messageReactions.$inferSelect;
export type NewMessageReaction = typeof messageReactions.$inferInsert;

export type LocationCheck = typeof locationChecks.$inferSelect;
export type NewLocationCheck = typeof locationChecks.$inferInsert;

export type GeofenceConfig = typeof geofenceConfig.$inferSelect;
export type NewGeofenceConfig = typeof geofenceConfig.$inferInsert;

export type RateLimitConfig = typeof rateLimitConfig.$inferSelect;
export type NewRateLimitConfig = typeof rateLimitConfig.$inferInsert;
