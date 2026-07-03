import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  AdminAuthService,
  AdminService,
  LocationService,
} from "@campus-chat/services/services";

import { AdminSessionManager } from "../admin-session";
import { handleServiceResult } from "../errors";
import {
  adminLimitInputSchema,
  adminLoginInputSchema,
  adminLoginOutputSchema,
  adminLogoutOutputSchema,
  adminModerationReportSchema,
  adminModerationRoomSchema,
  adminModerationUserSchema,
  adminOverviewOutputSchema,
  adminRoomInputSchema,
  adminRoomMessagesInputSchema,
  adminRoomMessagesOutputSchema,
  adminUserDataSchema,
  adminUserInputSchema,
  createAdminInputSchema,
  geofenceSettingsOutputSchema,
  successOutputSchema,
  updateGeofenceSettingsInputSchema,
} from "../schemas";
import {
  adminProcedure,
  publicProcedure,
  router,
  superAdminProcedure,
} from "../trpc";

export const adminRouter = router({
  overview: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/overview",
        protected: "admin",
        summary: "Get moderation overview data",
        tags: ["Admin"],
      },
    })
    .output(adminOverviewOutputSchema)
    .query(async ({ ctx }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      return adminService.getOverview();
    }),

  geofence: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/geofence",
        protected: "admin",
        summary: "Get default campus geofence settings",
        tags: ["Admin"],
      },
    })
    .output(geofenceSettingsOutputSchema)
    .query(async ({ ctx }) => {
      const locationService = new LocationService(ctx.db, ctx.redis);
      return handleServiceResult(
        await locationService.getDefaultGeofenceSettings(),
      );
    }),

  updateGeofence: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/geofence",
        protected: "admin",
        summary: "Update default campus geofence settings",
        tags: ["Admin"],
      },
    })
    .input(updateGeofenceSettingsInputSchema)
    .output(geofenceSettingsOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const locationService = new LocationService(ctx.db, ctx.redis);
      return handleServiceResult(
        await locationService.updateDefaultGeofenceSettings(input),
      );
    }),

  reports: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/reports",
        protected: "admin",
        summary: "List moderation reports",
        tags: ["Admin"],
      },
    })
    .input(adminLimitInputSchema)
    .output(z.array(adminModerationReportSchema))
    .query(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      return adminService.listReports(input.limit);
    }),

  room: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/rooms/by-id",
        protected: "admin",
        summary: "Get room moderation details",
        tags: ["Admin"],
      },
    })
    .input(adminRoomInputSchema)
    .output(adminModerationRoomSchema.nullable())
    .query(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      const result = await adminService.getRoom(input.roomId);
      return result.ok ? result.value : null;
    }),

  roomMessages: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/rooms/messages",
        protected: "admin",
        summary: "List room messages for moderation",
        tags: ["Admin"],
      },
    })
    .input(adminRoomMessagesInputSchema)
    .output(adminRoomMessagesOutputSchema)
    .query(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      return adminService.listRoomMessages(input.roomId, input.limit);
    }),

  rooms: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/rooms",
        protected: "admin",
        summary: "List rooms for moderation",
        tags: ["Admin"],
      },
    })
    .input(adminLimitInputSchema)
    .output(z.array(adminModerationRoomSchema))
    .query(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      return adminService.listRooms(input.limit);
    }),

  removeRoom: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/rooms/remove",
        protected: "admin",
        summary: "Remove a room from the chat app",
        tags: ["Admin"],
      },
    })
    .input(adminRoomInputSchema)
    .output(successOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      handleServiceResult(await adminService.removeRoom(input.roomId));
      return { success: true };
    }),

  user: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/users/by-id",
        protected: "admin",
        summary: "Get user moderation details",
        tags: ["Admin"],
      },
    })
    .input(adminUserInputSchema)
    .output(adminModerationUserSchema.nullable())
    .query(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      const result = await adminService.getModerationUser(input.userId);
      return result.ok ? result.value : null;
    }),

  users: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/users/moderation",
        protected: "admin",
        summary: "List recent moderation target users",
        tags: ["Admin"],
      },
    })
    .input(adminLimitInputSchema)
    .output(z.array(adminModerationUserSchema))
    .query(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      return adminService.listUsers(input.limit);
    }),

  create: superAdminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/users",
        protected: "admin",
        summary: "Create an admin user",
        tags: ["Admin"],
      },
    })
    .input(createAdminInputSchema)
    .output(adminUserDataSchema)
    .mutation(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db, ctx.redis);
      const result = await adminService.createAdmin(input, ctx.admin.id);

      return handleServiceResult(result);
    }),

  getCurrent: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/current",
        protected: "admin",
        summary: "Get the current admin",
        tags: ["Admin"],
      },
    })
    .output(adminUserDataSchema)
    .query(({ ctx }) => ctx.admin),

  login: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/login",
        summary: "Create an admin session",
        tags: ["Admin"],
      },
    })
    .input(adminLoginInputSchema)
    .output(adminLoginOutputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.verifyAdminPassword) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Admin password verifier is not configured.",
        });
      }

      const authService = new AdminAuthService(
        ctx.db,
        ctx.redis,
        ctx.verifyAdminPassword,
      );
      const admin = handleServiceResult(
        await authService.verifyCredentials(input.email, input.password),
      );
      const adminSessionManager = new AdminSessionManager(ctx.db);
      const session = await adminSessionManager.create(admin, ctx);

      return {
        admin,
        expiresAt: session.expiresAt,
        token: session.token,
      };
    }),

  logout: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/logout",
        protected: "admin",
        summary: "Revoke the current admin session",
        tags: ["Admin"],
      },
    })
    .output(adminLogoutOutputSchema)
    .mutation(async ({ ctx }) => {
      const adminSessionManager = new AdminSessionManager(ctx.db);
      const success = ctx.adminToken
        ? await adminSessionManager.revoke(ctx.adminToken)
        : false;

      return { success };
    }),
});
