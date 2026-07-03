import { z } from "zod";

import {
  optionalBoundedStringSchema,
  participantRoleSchema,
  participantStatusSchema,
  roomStatusSchema,
  roomTypeSchema,
  timestampSchema,
  uuidSchema,
} from "./common";

export const roomSummarySchema = z.object({
  allowImages: z.boolean(),
  allowLinks: z.boolean(),
  createdAt: timestampSchema,
  createdByUserId: uuidSchema,
  description: z.string().nullable(),
  expiresAt: timestampSchema.nullable(),
  id: uuidSchema,
  lastMessageAt: timestampSchema.nullable(),
  messageCount: z.number().int().min(0),
  name: z.string(),
  participantCount: z.number().int().min(0),
  roomType: roomTypeSchema,
  slug: z.string().nullable(),
  slowModeSeconds: z.number().int().min(0),
  status: roomStatusSchema,
});

export const roomDetailsSchema = roomSummarySchema.extend({
  inviteCode: z.string().nullable(),
  inviteCodeExpiresAt: timestampSchema.nullable(),
  maxParticipants: z.number().int().nullable(),
});

export const roomShareInfoSchema = z.object({
  canInvite: z.boolean(),
  inviteCode: z.string().nullable(),
  inviteCodeExpiresAt: timestampSchema.nullable(),
  isInviteEnabled: z.boolean(),
  roomId: uuidSchema,
  roomType: roomTypeSchema,
  sharePath: z.string(),
  slug: z.string().nullable(),
});

export const createRoomInputSchema = z.object({
  allowImages: z.boolean().optional(),
  allowLinks: z.boolean().optional(),
  description: optionalBoundedStringSchema(500),
  expiresAt: timestampSchema.optional(),
  maxParticipants: z.number().int().min(2).max(5000).optional(),
  name: z.string().trim().min(2).max(100),
  roomType: roomTypeSchema.optional(),
  slug: optionalBoundedStringSchema(100),
});

export const getRoomByIdInputSchema = z.object({
  inviteCode: optionalBoundedStringSchema(50),
  roomId: uuidSchema,
});

export const getRoomBySlugInputSchema = z.object({
  inviteCode: optionalBoundedStringSchema(50),
  slug: z.string().trim().min(1).max(100),
});

export const getRoomShareInfoInputSchema = z.object({
  inviteCode: optionalBoundedStringSchema(50),
  roomId: uuidSchema,
});

export const regenerateRoomInviteInputSchema = z.object({
  expiresAt: timestampSchema.optional(),
  roomId: uuidSchema,
});

export const disableRoomInviteInputSchema = z.object({
  roomId: uuidSchema,
});

export const listRoomsInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const listRoomsOutputSchema = z.object({
  hasMore: z.boolean(),
  items: z.array(roomSummarySchema),
  nextCursor: z.string().nullable(),
});

export const roomCreationLimitsOutputSchema = z.object({
  currentRoomsCreated: z.number().int().min(0),
  maxRoomsPerUser: z.number().int().min(1),
});

export const joinRoomInputSchema = z.object({
  inviteCode: optionalBoundedStringSchema(50),
  roomId: uuidSchema,
});

export const joinRoomOutputSchema = z.object({
  isNewJoin: z.boolean(),
  participantId: uuidSchema,
  role: participantRoleSchema,
});

export const leaveRoomInputSchema = z.object({
  roomId: uuidSchema,
});

export const participantSchema = z.object({
  bannedAt: timestampSchema.nullable(),
  banExpiresAt: timestampSchema.nullable(),
  displayColor: z.string(),
  displayName: z.string(),
  id: uuidSchema,
  joinedAt: timestampSchema,
  lastMessageAt: timestampSchema.nullable(),
  role: participantRoleSchema,
  roomId: uuidSchema,
  status: participantStatusSchema,
  userId: uuidSchema,
});

export const getParticipantsInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(100),
  roomId: uuidSchema,
});
