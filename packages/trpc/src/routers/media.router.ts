import { MediaService } from "@campus-chat/services/services";
import { generateToken } from "@campus-chat/services/utils";

import { assertCanReadRoom } from "../access";
import { handleServiceResult } from "../errors";
import {
  createUploadTokenInputSchema,
  createUploadTokenOutputSchema,
  getAssetInputSchema,
  mediaAssetDataSchema,
} from "../schemas";
import { router, sessionProcedure } from "../trpc";

export const mediaRouter = router({
  createUploadToken: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/media/upload-token",
        protected: "session",
        summary: "Create metadata for a direct media upload",
        tags: ["Media"],
      },
    })
    .input(createUploadTokenInputSchema)
    .output(createUploadTokenOutputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.targetRoomId) {
        await assertCanReadRoom(ctx, input.targetRoomId);
      }

      const mediaService = new MediaService(ctx.db, ctx.redis);
      const token = generateToken();
      const result = await mediaService.createUploadToken(
        ctx.session.userId,
        ctx.session.sessionId,
        {
          ...input,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          token,
        },
      );

      return {
        token,
        uploadToken: handleServiceResult(result),
      };
    }),

  getAsset: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/media/assets/by-id",
        protected: "session",
        summary: "Get media asset metadata",
        tags: ["Media"],
      },
    })
    .input(getAssetInputSchema)
    .output(mediaAssetDataSchema)
    .query(async ({ ctx, input }) => {
      const mediaService = new MediaService(ctx.db, ctx.redis);
      const result = await mediaService.getAsset(input.assetId);

      return handleServiceResult(result);
    }),
});
