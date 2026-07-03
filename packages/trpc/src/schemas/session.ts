import { z } from "zod";

import {
  activeBanInfoSchema,
  boundedStringSchema,
  optionalBoundedStringSchema,
  timestampSchema,
  userStatusSchema,
  uuidSchema,
} from "./common";
import { userProfileSchema } from "./user";

export const sessionDataSchema = z.object({
  createdAt: timestampSchema,
  displayColor: z.string(),
  displayName: z.string(),
  lastSeenAt: timestampSchema,
  locationVerified: z.boolean(),
  riskScore: z.number().int().min(0).max(100),
  sessionId: uuidSchema,
  status: userStatusSchema,
  trustLevel: z.number().int().min(0).max(100),
  userId: uuidSchema,
});

export const createSessionInputSchema = z.object({
  asn: optionalBoundedStringSchema(20),
  deviceInstallId: optionalBoundedStringSchema(255),
  fingerprint: optionalBoundedStringSchema(255),
  ipSubnet: optionalBoundedStringSchema(50),
});

export const createSessionOutputSchema = z.object({
  banInfo: activeBanInfoSchema.nullable(),
  session: sessionDataSchema,
  token: z.string(),
});

export const validateSessionInputSchema = z.object({
  token: boundedStringSchema(4096),
});

export const validateSessionOutputSchema = z.object({
  banInfo: activeBanInfoSchema.nullable(),
  session: sessionDataSchema.nullable(),
  valid: z.boolean(),
});

export const revokeSessionInputSchema = z.object({
  reason: z.string().trim().max(100).default("user_logout"),
  sessionId: uuidSchema.optional(),
});

export const updateDisplayNameInputSchema = z.object({
  displayName: boundedStringSchema(50),
});

export const updateDisplayColorInputSchema = z.object({
  displayColor: z.string().trim().min(4).max(7),
});

export const updateDisplayNameOutputSchema = z.object({
  session: sessionDataSchema,
  user: userProfileSchema,
});

export const updateDisplayColorOutputSchema = z.object({
  session: sessionDataSchema,
  user: userProfileSchema,
});
