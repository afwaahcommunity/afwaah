import type {
  BanEvidenceType,
  BanType,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  RiskLevel,
  RiskSignalType,
} from "./common";

export interface CreateReportInput {
  description?: string;
  evidenceSnapshot?: Record<string, unknown>;
  reason: ReportReason;
  targetMessageId?: string;
  targetRoomId?: string;
  targetType: ReportTargetType;
  targetUserId?: string;
}

export interface ReportData {
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
  status: ReportStatus;
  targetMessageId: string | null;
  targetRoomId: string | null;
  targetType: ReportTargetType;
  targetUserId: string | null;
}

export interface BanInput {
  banType: BanType;
  confidenceScore?: number;
  expiresAt?: Date;
  internalNotes?: string;
  isPermanent?: boolean;
  reason: string;
  targetRoomId?: string;
  targetSessionId?: string;
  targetUserId?: string;
}

export interface BanEvidenceInput {
  description?: string;
  evidenceType: BanEvidenceType;
  matchConfidence: number;
  matchedAgainstBanId?: string;
  rawData?: Record<string, unknown>;
  signalName: string;
  signalValueHash?: Buffer | null;
  signalValuePreview?: string;
}

export interface BanEvidenceData {
  banId: string;
  createdAt: Date;
  description: string | null;
  evidenceType: BanEvidenceType;
  id: string;
  matchConfidence: number;
  matchedAgainstBanId: string | null;
  rawData: Record<string, unknown> | null;
  signalName: string;
  signalValueHash: Buffer | null;
  signalValuePreview: string | null;
}

export interface RiskSignalInput {
  concurrentUsersEstimate?: number;
  isSharedSignal?: boolean;
  riskLevel: RiskLevel;
  riskScore: number;
  signalType: RiskSignalType;
  signalValueHash: Buffer;
}

export interface BanData {
  banType: BanType;
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
}
