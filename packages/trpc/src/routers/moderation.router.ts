import { TRPCError } from "@trpc/server";
import { BanService, ReportService } from "@campus-chat/services/services";
import { ModerationRepository } from "@campus-chat/services/repositories";
import type {
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from "@campus-chat/services/types";

import { handleServiceResult } from "../errors";
import {
  banDataSchema,
  banUserInputSchema,
  getReportInputSchema,
  reportDataSchema,
  resolveReportInputSchema,
  revokeBanInputSchema,
} from "../schemas";
import { adminProcedure, router } from "../trpc";

export const moderationRouter = router({
  banUser: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/moderation/bans",
        protected: "admin",
        summary: "Create a user/session ban",
        tags: ["Moderation"],
      },
    })
    .input(banUserInputSchema)
    .output(banDataSchema)
    .mutation(async ({ ctx, input }) => {
      const banService = new BanService(ctx.db, ctx.redis);
      const result = await banService.banUser(ctx.admin.id, input);

      return handleServiceResult(result);
    }),

  getReport: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/moderation/reports/by-id",
        protected: "admin",
        summary: "Get a moderation report by id",
        tags: ["Moderation"],
      },
    })
    .input(getReportInputSchema)
    .output(reportDataSchema)
    .query(async ({ ctx, input }) => {
      const moderationRepo = new ModerationRepository(ctx.db);
      const report = await moderationRepo.findReportById(input.reportId);

      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found.",
        });
      }

      return {
        createdAt: report.createdAt,
        description: report.description,
        id: report.id,
        reason: report.reason as ReportReason,
        reporterSessionId: report.reporterSessionId,
        reporterUserId: report.reporterUserId,
        resolutionAction: report.resolutionAction,
        resolutionNotes: report.resolutionNotes,
        resolvedAt: report.resolvedAt,
        resolvedByAdminId: report.resolvedByAdminId,
        status: report.status as ReportStatus,
        targetMessageId: report.targetMessageId,
        targetRoomId: report.targetRoomId,
        targetType: report.targetType as ReportTargetType,
        targetUserId: report.targetUserId,
      };
    }),

  resolveReport: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/moderation/reports/resolve",
        protected: "admin",
        summary: "Resolve or dismiss a moderation report",
        tags: ["Moderation"],
      },
    })
    .input(resolveReportInputSchema)
    .output(reportDataSchema)
    .mutation(async ({ ctx, input }) => {
      const reportService = new ReportService(ctx.db, ctx.redis);
      const result = await reportService.resolveReport(
        input.reportId,
        ctx.admin.id,
        input.status,
        input.resolutionAction,
        input.resolutionNotes,
      );

      const report = handleServiceResult(result);
      return {
        ...report,
        reason: report.reason as ReportReason,
      };
    }),

  revokeBan: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/moderation/bans/revoke",
        protected: "admin",
        summary: "Revoke an active ban",
        tags: ["Moderation"],
      },
    })
    .input(revokeBanInputSchema)
    .output(banDataSchema)
    .mutation(async ({ ctx, input }) => {
      const banService = new BanService(ctx.db, ctx.redis);
      const result = await banService.revokeBan(
        input.banId,
        ctx.admin.id,
        input.reason,
      );

      return handleServiceResult(result);
    }),
});
