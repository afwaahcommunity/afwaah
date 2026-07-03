import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.coerce.date();

export const boundedStringSchema = (max: number) =>
  z.string().trim().min(1).max(max);

export const optionalBoundedStringSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const paginationInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const successOutputSchema = z.object({
  success: z.boolean(),
});

export const userStatusSchema = z.enum([
  "active",
  "hard_banned",
  "quarantined",
  "write_banned",
]);

export const roomTypeSchema = z.enum(["announcement", "private", "public"]);
export const roomStatusSchema = z.enum([
  "active",
  "archived",
  "deleted",
  "locked",
]);

export const participantRoleSchema = z.enum(["creator", "member", "moderator"]);
export const participantStatusSchema = z.enum([
  "active",
  "banned",
  "kicked",
  "left",
]);

export const messageBodyTypeSchema = z.enum(["image", "system", "text"]);
export const messageStatusSchema = z.enum([
  "deleted",
  "moderation_hidden",
  "moderation_pending",
  "visible",
]);

export const banTypeSchema = z.enum([
  "global_hard_ban",
  "global_write_ban",
  "quarantine",
  "room_ban",
]);

export const reportReasonSchema = z.enum([
  "harassment",
  "hate_speech",
  "illegal_content",
  "impersonation",
  "other",
  "spam",
  "threats",
]);
export const reportStatusSchema = z.enum([
  "dismissed",
  "pending",
  "resolved",
  "reviewing",
]);
export const reportTargetTypeSchema = z.enum(["message", "room", "user"]);

export const adminRoleSchema = z.enum(["admin", "moderator", "super_admin"]);

export const uploadPurposeSchema = z.enum([
  "message_attachment",
  "profile_avatar",
  "room_avatar",
]);
export const uploadTokenStatusSchema = z.enum([
  "cancelled",
  "expired",
  "failed",
  "pending",
  "uploading",
  "used",
]);
export const mediaStatusSchema = z.enum([
  "active",
  "deleted",
  "processing",
  "quarantined",
  "uploading",
]);
export const moderationStatusSchema = z.enum([
  "approved",
  "auto_approved",
  "flagged",
  "pending",
  "rejected",
]);

export const verificationMethodSchema = z.enum([
  "browser_geolocation",
  "ip_geolocation",
  "manual_override",
]);

export const activeBanInfoSchema = z.object({
  banId: uuidSchema,
  banType: banTypeSchema,
  confidence: z.number().int().min(0).max(100),
  expiresAt: timestampSchema.nullable(),
  reason: z.string(),
  targetRoomId: uuidSchema.nullable(),
});
