import { z } from "zod";

import {
  messageBodyTypeSchema,
  messageStatusSchema,
  timestampSchema,
  uuidSchema,
} from "./common";

export const messageDataSchema = z.object({
  body: z.string(),
  bodyType: messageBodyTypeSchema,
  clientMessageId: uuidSchema,
  createdAt: timestampSchema,
  displayColorSnapshot: z.string(),
  displayNameSnapshot: z.string(),
  editedAt: timestampSchema.nullable(),
  id: uuidSchema,
  mediaAssetId: uuidSchema.nullable(),
  myReactions: z.array(z.string()),
  reactionCounts: z.record(z.string(), z.number()),
  replyToMessageId: uuidSchema.nullable(),
  roomId: uuidSchema,
  sessionId: uuidSchema,
  status: messageStatusSchema,
  userId: uuidSchema,
});

export const reactionDataSchema = z.object({
  createdAt: timestampSchema,
  emoji: z.string(),
  id: uuidSchema,
  messageId: uuidSchema,
  userId: uuidSchema,
});

export const getMessageHistoryInputSchema = z
  .object({
    after: timestampSchema.optional(),
    before: timestampSchema.optional(),
    limit: z.number().int().min(1).max(100).default(50),
    roomId: uuidSchema,
  })
  .refine((input) => !(input.after && input.before), {
    message: "Use either before or after, not both.",
    path: ["before"],
  });

export const getMessageHistoryOutputSchema = z.object({
  hasMore: z.boolean(),
  items: z.array(messageDataSchema),
  nextCursor: z.string().nullable(),
});

export const getMessageByIdInputSchema = z.object({
  messageId: uuidSchema,
});

export const getRecentMessagesInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  roomId: uuidSchema,
});

export const addReactionInputSchema = z.object({
  emoji: z.string().trim().min(1).max(20),
  messageId: uuidSchema,
});

export const removeReactionInputSchema = z.object({
  emoji: z.string().trim().min(1).max(20),
  messageId: uuidSchema,
});

export const deleteOwnMessageInputSchema = z.object({
  messageId: uuidSchema,
});
