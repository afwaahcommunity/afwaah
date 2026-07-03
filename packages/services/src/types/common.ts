export interface ServiceContext {
  ipAddress: string;
  requestId?: string;
  userAgent: string;
}

export type Result<T, E = ServiceError> =
  { ok: true; value: T } | { ok: false; error: E };

export interface ServiceError {
  code: ErrorCode;
  details?: Record<string, unknown>;
  message: string;
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(error: ServiceError): Result<never> {
  return { ok: false, error };
}

export type ErrorCode =
  | "ADMIN_INACTIVE"
  | "ADMIN_NOT_FOUND"
  | "BAN_ACTIVE"
  | "DISPLAY_NAME_INVALID"
  | "GEOFENCE_NOT_CONFIGURED"
  | "INTERNAL_ERROR"
  | "INVALID_REPLY_TARGET"
  | "INVALID_TOKEN"
  | "LOCATION_OUTSIDE_GEOFENCE"
  | "MEDIA_NOT_FOUND"
  | "MESSAGE_EMPTY"
  | "MESSAGE_NOT_FOUND"
  | "MESSAGE_TOO_LONG"
  | "NOT_ROOM_PARTICIPANT"
  | "RATE_LIMITED"
  | "REPORT_NOT_FOUND"
  | "ROOM_ARCHIVED"
  | "ROOM_BANNED"
  | "ROOM_EXPIRED"
  | "ROOM_FULL"
  | "ROOM_LOCKED"
  | "ROOM_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "SESSION_REVOKED"
  | "USER_NOT_FOUND"
  | "VALIDATION_ERROR";

export type UserStatus =
  "active" | "hard_banned" | "quarantined" | "write_banned";

export type RoomStatus = "active" | "archived" | "deleted" | "locked";
export type RoomType = "announcement" | "private" | "public";
export type ParticipantRole = "creator" | "member" | "moderator";
export type ParticipantStatus = "active" | "banned" | "kicked" | "left";
export type MessageStatus =
  "deleted" | "moderation_hidden" | "moderation_pending" | "visible";
export type MessageBodyType = "image" | "system" | "text";
export type BanType =
  "global_hard_ban" | "global_write_ban" | "quarantine" | "room_ban";

export type BanEvidenceType =
  | "admin_observation"
  | "automated_detection"
  | "behavior_pattern"
  | "content_similarity"
  | "device_match"
  | "fingerprint_match"
  | "ip_match"
  | "session_match"
  | "subnet_match"
  | "user_report";

export type RiskSignalType =
  | "asn"
  | "device_id_hash"
  | "fingerprint_hash"
  | "ip_hash"
  | "subnet_hash"
  | "user_agent_hash";

export type RiskLevel =
  "blocked" | "high" | "low" | "medium" | "safe" | "unknown";

export type ReportReason =
  | "harassment"
  | "hate_speech"
  | "illegal_content"
  | "impersonation"
  | "other"
  | "spam"
  | "threats";

export type ReportStatus = "dismissed" | "pending" | "resolved" | "reviewing";
export type ReportTargetType = "message" | "room" | "user";
export type AdminRole = "admin" | "moderator" | "super_admin";
export type MediaStatus =
  "active" | "deleted" | "processing" | "quarantined" | "uploading";
export type ModerationStatus =
  "approved" | "auto_approved" | "flagged" | "pending" | "rejected";
export type UploadTokenStatus =
  "cancelled" | "expired" | "failed" | "pending" | "uploading" | "used";
export type UploadPurpose =
  "message_attachment" | "profile_avatar" | "room_avatar";
export type VerificationMethod =
  "browser_geolocation" | "ip_geolocation" | "manual_override";

export type RateLimitAction =
  | "display_color_change"
  | "display_name_change"
  | "image_upload"
  | "message_burst"
  | "message_send"
  | "reaction_add"
  | "report_create"
  | "room_create"
  | "room_join";

export interface PaginatedResult<T> {
  hasMore: boolean;
  items: T[];
  nextCursor: string | null;
}

export interface ActiveBanInfo {
  banId: string;
  banType: BanType;
  confidence: number;
  expiresAt: Date | null;
  reason: string;
  targetRoomId: string | null;
}
