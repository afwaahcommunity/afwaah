import { z } from "zod";

import {
  adminRoleSchema,
  boundedStringSchema,
  reportReasonSchema,
  reportStatusSchema,
  reportTargetTypeSchema,
  roomStatusSchema,
  roomTypeSchema,
  timestampSchema,
  uuidSchema,
} from "./common";
import { banDataSchema } from "./moderation";
import { messageDataSchema } from "./message";

export const adminUserDataSchema = z.object({
  createdAt: timestampSchema,
  displayName: z.string(),
  email: z.string().email(),
  id: uuidSchema,
  isActive: z.boolean(),
  lastLoginAt: timestampSchema.nullable(),
  role: adminRoleSchema,
});

export const adminLoginInputSchema = z.object({
  email: z.string().trim().email().max(255),
  password: boundedStringSchema(255),
});

export const adminLoginOutputSchema = z.object({
  admin: adminUserDataSchema,
  expiresAt: timestampSchema,
  token: z.string(),
});

export const adminLogoutOutputSchema = z.object({
  success: z.boolean(),
});

export const createAdminInputSchema = z.object({
  displayName: boundedStringSchema(100),
  email: z.string().trim().email().max(255),
  passwordHash: boundedStringSchema(255),
  permissions: z.array(z.string()).optional(),
  role: adminRoleSchema.optional(),
});

export const adminModerationRoomSchema = z.object({
  allowImages: z.boolean(),
  allowLinks: z.boolean(),
  createdAt: timestampSchema,
  createdByUserId: uuidSchema,
  description: z.string().nullable(),
  id: uuidSchema,
  lastActivityAt: timestampSchema,
  lastMessageAt: timestampSchema.nullable(),
  messageCount: z.number().int().min(0),
  name: z.string(),
  participantCount: z.number().int().min(0),
  roomType: roomTypeSchema,
  slug: z.string().nullable(),
  slowModeSeconds: z.number().int().min(0),
  status: roomStatusSchema,
});

export const adminReportContextSchema = z.object({
  displayColor: z.string().optional(),
  displayName: z.string().optional(),
  messageContent: z.string().optional(),
  roomName: z.string().optional(),
});

export const adminModerationReportSchema = z.object({
  context: adminReportContextSchema,
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: uuidSchema,
  reason: reportReasonSchema,
  reportedUserId: uuidSchema.nullable(),
  reporterSessionId: uuidSchema.nullable(),
  reporterUserId: uuidSchema,
  resolutionAction: z.string().nullable(),
  resolutionNotes: z.string().nullable(),
  resolvedAt: timestampSchema.nullable(),
  resolvedByAdminId: uuidSchema.nullable(),
  status: reportStatusSchema,
  targetId: uuidSchema,
  targetMessageId: uuidSchema.nullable(),
  targetRoomId: uuidSchema.nullable(),
  targetType: reportTargetTypeSchema,
  targetUserId: uuidSchema.nullable(),
});

export const adminModerationUserSchema = z.object({
  banHistory: z.array(banDataSchema),
  createdAt: timestampSchema,
  currentBan: banDataSchema.nullable(),
  displayColor: z.string(),
  displayName: z.string(),
  id: uuidSchema,
  lastSeenAt: timestampSchema,
  reportCount: z.number().int().min(0),
});

export const adminOverviewOutputSchema = z.object({
  activeBans: z.number().int().min(0),
  flaggedUsers: z.array(adminModerationUserSchema),
  openReports: z.number().int().min(0),
  recentActions: z.array(
    z.object({
      action: z.string(),
      admin: z.string(),
      at: timestampSchema,
      id: z.string(),
      target: z.string(),
    }),
  ),
  recentRooms: z.array(adminModerationRoomSchema),
});

export const adminLimitInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(100),
});

export const adminUserInputSchema = z.object({
  userId: uuidSchema,
});

export const adminRoomInputSchema = z.object({
  roomId: uuidSchema,
});

export const adminRoomMessagesInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(100),
  roomId: uuidSchema,
});

export const adminRoomMessagesOutputSchema = z.array(messageDataSchema);
