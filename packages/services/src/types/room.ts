import type { ParticipantRole, RoomStatus, RoomType } from "./common";

export interface RoomSummary {
  allowImages: boolean;
  allowLinks: boolean;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  id: string;
  lastMessageAt: Date | null;
  messageCount: number;
  name: string;
  participantCount: number;
  roomType: RoomType;
  slug: string | null;
  slowModeSeconds: number;
  status: RoomStatus;
}

export interface RoomDetails extends RoomSummary {
  expiresAt: Date | null;
  inviteCode: string | null;
  inviteCodeExpiresAt: Date | null;
  maxParticipants: number | null;
}

export interface RoomShareInfo {
  canInvite: boolean;
  inviteCode: string | null;
  inviteCodeExpiresAt: Date | null;
  isInviteEnabled: boolean;
  roomId: string;
  roomType: RoomType;
  sharePath: string;
  slug: string | null;
}

export interface CreateRoomInput {
  allowImages?: boolean;
  allowLinks?: boolean;
  description?: string;
  expiresAt?: Date;
  maxParticipants?: number;
  name: string;
  roomType?: RoomType;
  slug?: string;
}

export interface JoinRoomResult {
  isNewJoin: boolean;
  participantId: string;
  role: ParticipantRole;
}
