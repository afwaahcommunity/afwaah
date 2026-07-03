import { z } from "zod";

import {
  banTypeSchema,
  boundedStringSchema,
  optionalBoundedStringSchema,
  timestampSchema,
  uuidSchema,
} from "./common";

export const banDataSchema = z.object({
  banType: banTypeSchema,
  confidenceScore: z.number().int().min(0).max(100),
  createdAt: timestampSchema,
  createdByAdminId: uuidSchema,
  expiresAt: timestampSchema.nullable(),
  id: uuidSchema,
  isActive: z.boolean(),
  isPermanent: z.boolean(),
  reason: z.string(),
  revokedAt: timestampSchema.nullable(),
  revokedByAdminId: uuidSchema.nullable(),
  targetRoomId: uuidSchema.nullable(),
  targetSessionId: uuidSchema.nullable(),
  targetUserId: uuidSchema.nullable(),
});

export const banUserInputSchema = z
  .object({
    banType: banTypeSchema,
    confidenceScore: z.number().int().min(0).max(100).optional(),
    expiresAt: timestampSchema.optional(),
    internalNotes: optionalBoundedStringSchema(2000),
    isPermanent: z.boolean().optional(),
    reason: boundedStringSchema(500),
    targetRoomId: uuidSchema.optional(),
    targetSessionId: uuidSchema.optional(),
    targetUserId: uuidSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.targetUserId && !input.targetSessionId) {
      ctx.addIssue({
        code: "custom",
        message: "A user or session target is required.",
        path: ["targetUserId"],
      });
    }

    if (input.banType === "room_ban" && !input.targetRoomId) {
      ctx.addIssue({
        code: "custom",
        message: "Room bans require a room target.",
        path: ["targetRoomId"],
      });
    }

    if (input.banType !== "room_ban" && input.targetRoomId) {
      ctx.addIssue({
        code: "custom",
        message: "Only room bans can include a room target.",
        path: ["targetRoomId"],
      });
    }

    if (!input.isPermanent && !input.expiresAt) {
      ctx.addIssue({
        code: "custom",
        message: "Temporary bans require an expiry.",
        path: ["expiresAt"],
      });
    }
  });

export const revokeBanInputSchema = z.object({
  banId: uuidSchema,
  reason: boundedStringSchema(500),
});

export const resolveReportInputSchema = z.object({
  reportId: uuidSchema,
  resolutionAction: optionalBoundedStringSchema(50),
  resolutionNotes: optionalBoundedStringSchema(2000),
  status: z.enum(["dismissed", "resolved"]),
});

export const getReportInputSchema = z.object({
  reportId: uuidSchema,
});
