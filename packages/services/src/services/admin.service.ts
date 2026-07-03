import type { RedisClient } from "../cache";
import { createError } from "../errors";
import {
  AdminRepository,
  ModerationRepository,
  RoomRepository,
  UserRepository,
  type DrizzleClient,
} from "../repositories";
import type {
  AdminModerationReport,
  AdminModerationRoom,
  AdminModerationUser,
  AdminOverviewData,
  AdminRoomMessage,
  AdminUserData,
  BanData,
  CreateAdminInput,
  ReportData,
  Result,
  RoomStatus,
} from "../types";
import { err, ok } from "../types";
import { MessageService } from "./message.service";

export class AdminService {
  private readonly adminRepo: AdminRepository;
  private readonly db: DrizzleClient;
  private readonly moderationRepo: ModerationRepository;
  private readonly redis: RedisClient;
  private readonly roomRepo: RoomRepository;
  private readonly userRepo: UserRepository;

  constructor(db: DrizzleClient, redis: RedisClient) {
    this.db = db;
    this.redis = redis;
    this.adminRepo = new AdminRepository(db);
    this.moderationRepo = new ModerationRepository(db);
    this.roomRepo = new RoomRepository(db);
    this.userRepo = new UserRepository(db);
  }

  async createAdmin(
    input: CreateAdminInput,
    createdByAdminId?: string,
  ): Promise<Result<AdminUserData>> {
    const normalizedInput = {
      ...input,
      displayName: input.displayName.trim(),
      email: input.email.trim().toLowerCase(),
    };
    const validationError = validateCreateAdminInput(normalizedInput);
    if (validationError) {
      return err(createError("VALIDATION_ERROR", validationError));
    }

    const existing = await this.adminRepo.findByEmail(normalizedInput.email);
    if (existing) {
      return err(
        createError("VALIDATION_ERROR", "Admin email already exists."),
      );
    }

    const admin = await this.adminRepo.create(
      normalizedInput,
      createdByAdminId,
    );
    return ok(mapAdmin(admin));
  }

  async getAdminById(adminId: string): Promise<Result<AdminUserData>> {
    const admin = await this.adminRepo.findById(adminId);
    return admin
      ? ok(mapAdmin(admin))
      : err(createError("ADMIN_NOT_FOUND", "Admin not found."));
  }

  async getOverview(): Promise<AdminOverviewData> {
    const [openReports, activeBans, recentRooms, flaggedUsers] =
      await Promise.all([
        this.moderationRepo.countOpenReports(),
        this.moderationRepo.countActiveBans(),
        this.roomRepo.listForAdmin(5),
        this.listUsers(5),
      ]);

    return {
      activeBans,
      flaggedUsers,
      openReports,
      recentActions: [],
      recentRooms: recentRooms.map(mapAdminRoom),
    };
  }

  async listReports(limit = 100): Promise<AdminModerationReport[]> {
    const reports = await this.moderationRepo.listReports(limit);
    return reports.map(mapAdminReport);
  }

  async listUsers(limit = 20): Promise<AdminModerationUser[]> {
    const flaggedUsers = await this.moderationRepo.listFlaggedUserIds(limit);
    const users = await Promise.all(
      flaggedUsers.map((user) => this.getModerationUser(user.userId)),
    );

    return users.flatMap((result) => (result.ok ? [result.value] : []));
  }

  async getModerationUser(
    userId: string,
  ): Promise<Result<AdminModerationUser>> {
    const user = await this.userRepo.findById(userId);
    if (!user) return err(createError("USER_NOT_FOUND", "User not found."));

    const [reportCount, banHistory] = await Promise.all([
      this.moderationRepo.countReportsForUser(userId),
      this.moderationRepo.listBansByUserId(userId),
    ]);
    const activeBan =
      banHistory.find(
        (ban) =>
          ban.isActive && (!ban.expiresAt || ban.expiresAt > new Date()),
      ) ?? null;

    return ok({
      banHistory: banHistory.map(mapBan),
      createdAt: user.createdAt,
      currentBan: activeBan ? mapBan(activeBan) : null,
      displayColor: user.currentDisplayColor,
      displayName: user.currentDisplayName,
      id: user.id,
      lastSeenAt: user.lastSeenAt,
      reportCount,
    });
  }

  async listRooms(limit = 100): Promise<AdminModerationRoom[]> {
    const rooms = await this.roomRepo.listForAdmin(limit);
    return rooms.map(mapAdminRoom);
  }

  async getRoom(roomId: string): Promise<Result<AdminModerationRoom>> {
    const room = await this.roomRepo.findById(roomId);
    if (!room) return err(createError("ROOM_NOT_FOUND", "Room not found."));

    return ok(mapAdminRoom(room));
  }

  async listRoomMessages(
    roomId: string,
    limit = 100,
  ): Promise<AdminRoomMessage[]> {
    const messageService = new MessageService(this.db, this.redis);
    const result = await messageService.getMessageHistory({
      limit,
      roomId,
    });

    return result.items;
  }

  async removeRoom(roomId: string): Promise<Result<AdminModerationRoom>> {
    const room = await this.roomRepo.updateStatus(
      roomId,
      "deleted" as RoomStatus,
    );
    if (!room) return err(createError("ROOM_NOT_FOUND", "Room not found."));

    return ok(mapAdminRoom(room));
  }
}

function mapAdmin(admin: {
  createdAt: Date;
  displayName: string;
  email: string;
  id: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  role: string;
}): AdminUserData {
  return {
    createdAt: admin.createdAt,
    displayName: admin.displayName,
    email: admin.email,
    id: admin.id,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt,
    role: admin.role as AdminUserData["role"],
  };
}

function validateCreateAdminInput(input: CreateAdminInput): string | null {
  if (!isValidEmail(input.email)) return "Admin email is invalid.";
  if (!input.displayName) return "Admin display name is required.";
  if (input.displayName.length > 100) return "Admin display name is too long.";
  if (!input.passwordHash.trim()) return "Admin password hash is required.";
  if (input.passwordHash.length > 255)
    return "Admin password hash is too long.";

  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function mapAdminRoom(room: {
  allowImages: boolean;
  allowLinks: boolean;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  expiresAt: Date | null;
  id: string;
  lastMessageAt: Date | null;
  messageCount: number;
  name: string;
  participantCount: number;
  roomType: string;
  slug: string | null;
  slowModeSeconds: number | null;
  status: string;
}): AdminModerationRoom {
  return {
    allowImages: room.allowImages,
    allowLinks: room.allowLinks,
    createdAt: room.createdAt,
    createdByUserId: room.createdByUserId,
    description: room.description,
    expiresAt: room.expiresAt,
    id: room.id,
    lastActivityAt: room.lastMessageAt ?? room.createdAt,
    lastMessageAt: room.lastMessageAt,
    messageCount: room.messageCount,
    name: room.name,
    participantCount: room.participantCount,
    roomType: room.roomType as AdminModerationRoom["roomType"],
    slug: room.slug,
    slowModeSeconds: room.slowModeSeconds ?? 0,
    status: room.status as AdminModerationRoom["status"],
  };
}

function mapAdminReport(report: {
  createdAt: Date;
  description: string | null;
  evidenceSnapshot: Record<string, unknown>;
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
}): AdminModerationReport {
  const reportData: ReportData = {
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

  return {
    ...reportData,
    context: readReportContext(report.evidenceSnapshot),
    reason: report.reason as AdminModerationReport["reason"],
    reportedUserId: report.targetUserId,
    targetId:
      report.targetMessageId ??
      report.targetRoomId ??
      report.targetUserId ??
      report.id,
  };
}

function readReportContext(
  value: Record<string, unknown> | null,
): AdminModerationReport["context"] {
  if (!value) return {};

  return {
    displayColor: readString(value.displayColor),
    displayName: readString(value.displayName),
    messageContent: readString(value.messageContent),
    roomName: readString(value.roomName),
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function mapBan(ban: {
  banType: string;
  confidenceScore: number;
  createdAt: Date;
  createdByAdminId: string;
  expiresAt: Date | null;
  id: string;
  isActive: boolean;
  isPermanent: boolean;
  reason: string;
  revokedAt: Date | null;
  revokedByAdminId: string | null;
  targetRoomId: string | null;
  targetSessionId: string | null;
  targetUserId: string | null;
}): BanData {
  return {
    banType: ban.banType as BanData["banType"],
    confidenceScore: ban.confidenceScore,
    createdAt: ban.createdAt,
    createdByAdminId: ban.createdByAdminId,
    expiresAt: ban.expiresAt,
    id: ban.id,
    isActive: ban.isActive,
    isPermanent: ban.isPermanent,
    reason: ban.reason,
    revokedAt: ban.revokedAt,
    revokedByAdminId: ban.revokedByAdminId,
    targetRoomId: ban.targetRoomId,
    targetSessionId: ban.targetSessionId,
    targetUserId: ban.targetUserId,
  };
}
