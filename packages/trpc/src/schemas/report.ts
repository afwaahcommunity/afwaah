import { z } from "zod";

import {
  optionalBoundedStringSchema,
  reportReasonSchema,
  reportStatusSchema,
  reportTargetTypeSchema,
  timestampSchema,
  uuidSchema,
} from "./common";

export const reportDataSchema = z.object({
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: uuidSchema,
  reason: reportReasonSchema,
  reporterSessionId: uuidSchema.nullable(),
  reporterUserId: uuidSchema,
  resolutionAction: z.string().nullable(),
  resolutionNotes: z.string().nullable(),
  resolvedAt: timestampSchema.nullable(),
  resolvedByAdminId: uuidSchema.nullable(),
  status: reportStatusSchema,
  targetMessageId: uuidSchema.nullable(),
  targetRoomId: uuidSchema.nullable(),
  targetType: reportTargetTypeSchema,
  targetUserId: uuidSchema.nullable(),
});

export const createReportInputSchema = z
  .object({
    description: optionalBoundedStringSchema(2000),
    evidenceSnapshot: z.record(z.string(), z.unknown()).optional(),
    reason: reportReasonSchema,
    targetMessageId: uuidSchema.optional(),
    targetRoomId: uuidSchema.optional(),
    targetType: reportTargetTypeSchema,
    targetUserId: uuidSchema.optional(),
  })
  .superRefine((input, ctx) => {
    const targetByType = {
      message: input.targetMessageId,
      room: input.targetRoomId,
      user: input.targetUserId,
    };

    if (!targetByType[input.targetType]) {
      ctx.addIssue({
        code: "custom",
        message: `A ${input.targetType} report requires the matching target id.`,
        path: [`target${capitalize(input.targetType)}Id`],
      });
    }

    if (input.targetType === "message" && input.targetRoomId) {
      ctx.addIssue({
        code: "custom",
        message: "Message reports cannot include targetRoomId.",
        path: ["targetRoomId"],
      });
    }

    if (
      input.targetType === "room" &&
      (input.targetMessageId || input.targetUserId)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Room reports can only include targetRoomId.",
        path: ["targetRoomId"],
      });
    }

    if (
      input.targetType === "user" &&
      (input.targetMessageId || input.targetRoomId)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "User reports can only include targetUserId.",
        path: ["targetUserId"],
      });
    }
  });

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
