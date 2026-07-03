import { TRPCError } from "@trpc/server";
import { SessionService, UserService } from "@campus-chat/services/services";
import { z } from "zod";

import { handleServiceResult } from "../errors";
import {
  createSessionInputSchema,
  createSessionOutputSchema,
  displayNameHistoryEntrySchema,
  revokeSessionInputSchema,
  sessionDataSchema,
  updateDisplayColorInputSchema,
  updateDisplayColorOutputSchema,
  updateDisplayNameInputSchema,
  updateDisplayNameOutputSchema,
  validateSessionInputSchema,
  validateSessionOutputSchema,
} from "../schemas";
import { publicProcedure, router, sessionProcedure } from "../trpc";

export const sessionRouter = router({
  create: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/session/create",
        summary: "Create an anonymous session",
        tags: ["Session"],
      },
    })
    .input(createSessionInputSchema)
    .output(createSessionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const sessionService = new SessionService(ctx.db, ctx.redis);
      const result = await sessionService.createSession(input, {
        ipAddress: ctx.ipAddress,
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
      });

      return handleServiceResult(result);
    }),

  getCurrent: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/session/current",
        protected: "session",
        summary: "Get the current anonymous session",
        tags: ["Session"],
      },
    })
    .output(sessionDataSchema)
    .query(({ ctx }) => ctx.session),

  getDisplayNameHistory: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/session/display-name-history",
        protected: "session",
        summary: "Get display-name history for the current anonymous user",
        tags: ["Session"],
      },
    })
    .output(z.array(displayNameHistoryEntrySchema))
    .query(async ({ ctx }) => {
      const userService = new UserService(ctx.db, ctx.redis);
      const result = await userService.getDisplayNameHistory(
        ctx.session.userId,
      );

      return handleServiceResult(result);
    }),

  revoke: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/session/revoke",
        protected: "session",
        summary: "Revoke the current anonymous session",
        tags: ["Session"],
      },
    })
    .input(revokeSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const sessionId = input.sessionId ?? ctx.session.sessionId;
      if (sessionId !== ctx.session.sessionId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the current session can be revoked here.",
        });
      }

      const sessionService = new SessionService(ctx.db, ctx.redis);
      handleServiceResult(
        await sessionService.revokeSession(sessionId, input.reason),
      );

      return { success: true };
    }),

  updateDisplayName: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/session/display-name",
        protected: "session",
        summary: "Update the current user's public display name",
        tags: ["Session"],
      },
    })
    .input(updateDisplayNameInputSchema)
    .output(updateDisplayNameOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const userService = new UserService(ctx.db, ctx.redis);
      const user = handleServiceResult(
        await userService.updateDisplayName({
          newDisplayName: input.displayName,
          sessionId: ctx.session.sessionId,
          userId: ctx.session.userId,
        }),
      );

      return {
        session: {
          ...ctx.session,
          displayName: user.currentDisplayName,
          status: user.status,
        },
        user,
      };
    }),

  updateDisplayColor: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/session/display-color",
        protected: "session",
        summary: "Update the current user's public display color",
        tags: ["Session"],
      },
    })
    .input(updateDisplayColorInputSchema)
    .output(updateDisplayColorOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const userService = new UserService(ctx.db, ctx.redis);
      const user = handleServiceResult(
        await userService.updateDisplayColor({
          newDisplayColor: input.displayColor,
          sessionId: ctx.session.sessionId,
          userId: ctx.session.userId,
        }),
      );

      return {
        session: {
          ...ctx.session,
          displayColor: user.currentDisplayColor,
          status: user.status,
        },
        user,
      };
    }),

  validate: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/session/validate",
        summary: "Validate an anonymous session token",
        tags: ["Session"],
      },
    })
    .input(validateSessionInputSchema)
    .output(validateSessionOutputSchema)
    .query(async ({ ctx, input }) => {
      const sessionService = new SessionService(ctx.db, ctx.redis);
      const result = await sessionService.validateSession(input.token);

      return handleServiceResult(result);
    }),
});
