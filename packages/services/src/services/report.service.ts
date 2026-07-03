import { RateLimitCache, type RedisClient } from "../cache";
import { createError } from "../errors";
import {
  MessageRepository,
  ModerationRepository,
  type DrizzleClient,
} from "../repositories";
import type { CreateReportInput, ReportData, Result } from "../types";
import { err, ok } from "../types";
import { WriteGuardService } from "./write-guard.service";

export class ReportService {
  private readonly messageRepo: MessageRepository;
  private readonly moderationRepo: ModerationRepository;
  private readonly rateLimitCache: RateLimitCache;
  private readonly writeGuard: WriteGuardService;

  constructor(db: DrizzleClient, redis: RedisClient) {
    this.messageRepo = new MessageRepository(db);
    this.moderationRepo = new ModerationRepository(db);
    this.rateLimitCache = new RateLimitCache(redis);
    this.writeGuard = new WriteGuardService(db);
  }

  async createReport(
    reporterUserId: string,
    reporterSessionId: string,
    input: CreateReportInput,
  ): Promise<Result<ReportData>> {
    const validationError = validateReportInput(input);
    if (validationError) {
      return err(createError("VALIDATION_ERROR", validationError));
    }

    const roomId = await this.resolveTargetRoomId(input);
    if (roomId instanceof Error) {
      return err(createError("MESSAGE_NOT_FOUND", roomId.message));
    }

    const interactionAccess = await this.writeGuard.requireInteractionAccess({
      roomId,
      sessionId: reporterSessionId,
      userId: reporterUserId,
    });
    if (!interactionAccess.ok) return err(interactionAccess.error);

    const limit = await this.rateLimitCache.checkAndIncrement(
      "report_create",
      reporterUserId,
      { maxRequests: 10, windowSeconds: 3600 },
    );
    if (!limit.allowed) {
      return err(createError("RATE_LIMITED", "Report rate limited."));
    }

    const report = await this.moderationRepo.createReport(
      reporterUserId,
      reporterSessionId,
      input,
    );
    return ok(mapReport(report));
  }

  async resolveReport(
    reportId: string,
    adminId: string,
    status: "dismissed" | "resolved",
    resolutionAction?: string,
    resolutionNotes?: string,
  ): Promise<Result<ReportData>> {
    const report = await this.moderationRepo.resolveReport(
      reportId,
      adminId,
      status,
      resolutionAction,
      resolutionNotes,
    );

    return report
      ? ok(mapReport(report))
      : err(createError("REPORT_NOT_FOUND", "Report not found."));
  }

  private async resolveTargetRoomId(
    input: CreateReportInput,
  ): Promise<string | undefined | Error> {
    if (input.targetRoomId) return input.targetRoomId;
    if (!input.targetMessageId) return undefined;

    const message = await this.messageRepo.findById(input.targetMessageId);
    if (!message || message.status !== "visible") {
      return new Error("Message not found.");
    }

    return message.roomId;
  }
}

function mapReport(report: {
  createdAt: Date;
  description: string | null;
  id: string;
  reason: string;
  reporterSessionId: string | null;
  reporterUserId: string;
  resolutionAction: string | null;
  resolutionNotes: string | null;
  resolvedAt: Date | null;
  resolvedByAdminId: string | null;
  status: string;
  targetMessageId: string | null;
  targetRoomId: string | null;
  targetType: string;
  targetUserId: string | null;
}): ReportData {
  return {
    createdAt: report.createdAt,
    description: report.description,
    id: report.id,
    reason: report.reason,
    reporterSessionId: report.reporterSessionId,
    reporterUserId: report.reporterUserId,
    resolutionAction: report.resolutionAction,
    resolutionNotes: report.resolutionNotes,
    resolvedAt: report.resolvedAt,
    resolvedByAdminId: report.resolvedByAdminId,
    status: report.status as ReportData["status"],
    targetMessageId: report.targetMessageId,
    targetRoomId: report.targetRoomId,
    targetType: report.targetType as ReportData["targetType"],
    targetUserId: report.targetUserId,
  };
}

function validateReportInput(input: CreateReportInput): string | null {
  if (input.targetType === "message" && !input.targetMessageId) {
    return "Message reports require targetMessageId.";
  }
  if (input.targetType === "room" && !input.targetRoomId) {
    return "Room reports require targetRoomId.";
  }
  if (input.targetType === "user" && !input.targetUserId) {
    return "User reports require targetUserId.";
  }
  if (input.description && input.description.length > 2000) {
    return "Report description is too long.";
  }

  return null;
}
