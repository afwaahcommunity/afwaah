import { z } from "zod";

import { timestampSchema, verificationMethodSchema } from "./common";

export const verifyLocationInputSchema = z.object({
  accuracyMeters: z.number().positive().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  method: verificationMethodSchema.optional(),
});

export const verifyLocationOutputSchema = z.object({
  confidenceScore: z.number().int().min(0).max(100),
  distanceFromCenterKm: z.number(),
  isWithinGeofence: z.boolean(),
  validUntil: timestampSchema,
});

export const locationStatusOutputSchema = z.object({
  hasValidLocation: z.boolean(),
  locationVerified: z.boolean(),
});

export const geofenceSettingsOutputSchema = z.object({
  centerLatitude: z.number(),
  centerLongitude: z.number(),
  id: z.string().uuid(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  name: z.string(),
  radiusKm: z.number().min(0.1).max(50000),
  updatedAt: timestampSchema,
});

export const updateGeofenceSettingsInputSchema = z.object({
  radiusKm: z.number().min(0.1).max(50000),
});
