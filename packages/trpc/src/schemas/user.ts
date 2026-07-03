import { z } from "zod";

import { timestampSchema, userStatusSchema, uuidSchema } from "./common";

export const userProfileSchema = z.object({
  createdAt: timestampSchema,
  currentDisplayColor: z.string(),
  currentDisplayName: z.string(),
  id: uuidSchema,
  lastSeenAt: timestampSchema,
  riskScore: z.number().int().min(0).max(100),
  status: userStatusSchema,
  totalMessagesSent: z.number().int().min(0),
  totalReportsReceived: z.number().int().min(0),
  totalRoomsCreated: z.number().int().min(0),
  trustLevel: z.number().int().min(0).max(100),
});

export const displayNameHistoryEntrySchema = z.object({
  changeReason: z.string().nullable(),
  displayName: z.string(),
  endedAt: timestampSchema.nullable(),
  id: uuidSchema,
  startedAt: timestampSchema,
});
