import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { MessageService } from "@campus-chat/services/services";

import { assertCanReadRoom } from "../access";
import { handleServiceResult } from "../errors";
import {
  addReactionInputSchema,
  deleteOwnMessageInputSchema,
  getMessageByIdInputSchema,
  getMessageHistoryInputSchema,
  getMessageHistoryOutputSchema,
  getRecentMessagesInputSchema,
  messageDataSchema,
  reactionDataSchema,
  removeReactionInputSchema,
  successOutputSchema,
} from "../schemas";
import { router, sessionProcedure } from "../trpc";

export const messageRouter = router({
  addReaction: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/messages/reactions",
        protected: "session",
        summary: "Add a reaction to a visible message",
        tags: ["Messages"],
      },
    })
    .input(addReactionInputSchema)
    .output(reactionDataSchema)
    .mutation(async ({ ctx, input }) => {
      const messageService = new MessageService(ctx.db, ctx.redis);
      const result = await messageService.addReaction(
        ctx.session.userId,
        ctx.session.sessionId,
        input,
      );

      return handleServiceResult(result);
    }),

  deleteOwn: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/messages/delete-own",
        protected: "session",
        summary: "Delete a message owned by the current user",
        tags: ["Messages"],
      },
    })
    .input(deleteOwnMessageInputSchema)
    .output(successOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const messageService = new MessageService(ctx.db, ctx.redis);
      handleServiceResult(
        await messageService.deleteOwnMessage(
          input.messageId,
          ctx.session.userId,
          ctx.session.sessionId,
        ),
      );

      return { success: true };
    }),

  getById: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/messages/by-id",
        protected: "session",
        summary: "Get a visible message by id",
        tags: ["Messages"],
      },
    })
    .input(getMessageByIdInputSchema)
    .output(messageDataSchema)
    .query(async ({ ctx, input }) => {
      const messageService = new MessageService(ctx.db, ctx.redis);
      const message = handleServiceResult(
        await messageService.getMessageById(input.messageId, ctx.session.userId),
      );

      if (message.status !== "visible") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found.",
        });
      }

      await assertCanReadRoom(ctx, message.roomId);
      return message;
    }),

  getHistory: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/messages/history",
        protected: "session",
        summary: "Get room message history",
        tags: ["Messages"],
      },
    })
    .input(getMessageHistoryInputSchema)
    .output(getMessageHistoryOutputSchema)
    .query(async ({ ctx, input }) => {
      await assertCanReadRoom(ctx, input.roomId);

      const messageService = new MessageService(ctx.db, ctx.redis);
      return messageService.getMessageHistory(input, ctx.session.userId);
    }),

  getRecent: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/messages/recent",
        protected: "session",
        summary: "Get recent visible messages for a room",
        tags: ["Messages"],
      },
    })
    .input(getRecentMessagesInputSchema)
    .output(z.array(messageDataSchema))
    .query(async ({ ctx, input }) => {
      await assertCanReadRoom(ctx, input.roomId);

      const messageService = new MessageService(ctx.db, ctx.redis);
      return messageService.getRecentMessages(
        input.roomId,
        input.limit,
        ctx.session.userId,
      );
    }),

  removeReaction: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/messages/reactions/remove",
        protected: "session",
        summary: "Remove the current user's reaction from a message",
        tags: ["Messages"],
      },
    })
    .input(removeReactionInputSchema)
    .output(successOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const messageService = new MessageService(ctx.db, ctx.redis);
      handleServiceResult(
        await messageService.removeReaction(
          ctx.session.userId,
          ctx.session.sessionId,
          input.messageId,
          input.emoji,
        ),
      );

      return { success: true };
    }),
});
