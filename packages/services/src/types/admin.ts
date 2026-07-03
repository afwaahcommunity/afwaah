import type { AdminRole, ReportReason } from "./common";
import type { BanData, ReportData } from "./moderation";
import type { MessageData } from "./message";
import type { RoomSummary } from "./room";

export interface AdminUserData {
  createdAt: Date;
  displayName: string;
  email: string;
  id: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  role: AdminRole;
}

export interface CreateAdminInput {
  displayName: string;
  email: string;
  passwordHash: string;
  permissions?: unknown[];
  role?: AdminRole;
}

export interface AdminModerationRoom extends RoomSummary {
  lastActivityAt: Date;
}

export interface AdminReportContext {
  displayColor?: string;
  displayName?: string;
  messageContent?: string;
  roomName?: string;
}

export interface AdminModerationReport extends ReportData {
  context: AdminReportContext;
  reason: ReportReason;
  reportedUserId: string | null;
  targetId: string;
}

export interface AdminModerationUser {
  banHistory: BanData[];
  createdAt: Date;
  currentBan: BanData | null;
  displayColor: string;
  displayName: string;
  id: string;
  lastSeenAt: Date;
  reportCount: number;
}

export interface AdminOverviewData {
  activeBans: number;
  flaggedUsers: AdminModerationUser[];
  openReports: number;
  recentActions: Array<{
    action: string;
    admin: string;
    at: Date;
    id: string;
    target: string;
  }>;
  recentRooms: AdminModerationRoom[];
}

export type AdminRoomMessage = MessageData;
