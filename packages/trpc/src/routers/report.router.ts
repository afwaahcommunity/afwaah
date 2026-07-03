import { ReportService } from "@campus-chat/services/services";
import type { ReportReason } from "@campus-chat/services/types";

import { handleServiceResult } from "../errors";
import { createReportInputSchema, reportDataSchema } from "../schemas";
import { router, sessionProcedure } from "../trpc";

export const reportRouter = router({
  create: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/reports",
        protected: "session",
        summary: "Create a moderation report",
        tags: ["Reports"],
      },
    })
    .input(createReportInputSchema)
    .output(reportDataSchema)
    .mutation(async ({ ctx, input }) => {
      const reportService = new ReportService(ctx.db, ctx.redis);
      const result = await reportService.createReport(
        ctx.session.userId,
        ctx.session.sessionId,
        input,
      );

      const report = handleServiceResult(result);
      return {
        ...report,
        reason: report.reason as ReportReason,
      };
    }),
});
