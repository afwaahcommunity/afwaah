import { z } from "zod";

import {
  mediaStatusSchema,
  moderationStatusSchema,
  timestampSchema,
  uploadPurposeSchema,
  uploadTokenStatusSchema,
  uuidSchema,
} from "./common";

export const uploadTokenDataSchema = z.object({
  allowedMimeTypes: z.array(z.string()),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  id: uuidSchema,
  maxFileSizeBytes: z.number().int().positive(),
  sessionId: uuidSchema,
  status: uploadTokenStatusSchema,
  targetRoomId: uuidSchema.nullable(),
  uploadPurpose: uploadPurposeSchema,
  userId: uuidSchema,
});

export const mediaAssetDataSchema = z.object({
  createdAt: timestampSchema,
  fileSizeBytes: z.number().int().positive(),
  id: uuidSchema,
  mimeType: z.string(),
  moderationStatus: moderationStatusSchema,
  originalFilename: z.string().nullable(),
  status: mediaStatusSchema,
  storageKey: z.string(),
  uploadedBySessionId: uuidSchema,
  uploadedByUserId: uuidSchema,
});

export const createUploadTokenInputSchema = z.object({
  allowedMimeTypes: z.array(z.string().trim().min(1).max(100)).optional(),
  clientFileSize: z.number().int().positive().optional(),
  clientFilename: z.string().trim().max(255).optional(),
  clientMimeType: z.string().trim().max(100).optional(),
  maxFileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .optional(),
  targetRoomId: uuidSchema.optional(),
  uploadPurpose: uploadPurposeSchema.optional(),
});

export const createUploadTokenOutputSchema = z.object({
  token: z.string(),
  uploadToken: uploadTokenDataSchema,
});

export const getAssetInputSchema = z.object({
  assetId: uuidSchema,
});
