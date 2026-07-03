import type { UserStatus } from "./common";

export interface UserProfile {
  createdAt: Date;
  currentDisplayColor: string;
  currentDisplayName: string;
  id: string;
  lastSeenAt: Date;
  riskScore: number;
  status: UserStatus;
  totalMessagesSent: number;
  totalReportsReceived: number;
  totalRoomsCreated: number;
  trustLevel: number;
}

export interface UpdateDisplayNameInput {
  newDisplayName: string;
  sessionId?: string;
  userId: string;
}

export interface UpdateDisplayColorInput {
  newDisplayColor: string;
  sessionId: string;
  userId: string;
}

export interface DisplayNameHistoryEntry {
  changeReason: string | null;
  displayName: string;
  endedAt: Date | null;
  id: string;
  startedAt: Date;
}
