import type { ActiveBanInfo, UserStatus } from "./common";

export interface CreateSessionInput {
  asn?: string;
  deviceInstallId?: string;
  fingerprint?: string;
  ipAddress?: string;
  ipSubnet?: string;
  userAgent?: string;
}

export interface SessionData {
  createdAt: Date;
  displayColor: string;
  displayName: string;
  lastSeenAt: Date;
  locationVerified: boolean;
  riskScore: number;
  sessionId: string;
  status: UserStatus;
  trustLevel: number;
  userId: string;
}

export interface CreateSessionResult {
  banInfo: ActiveBanInfo | null;
  session: SessionData;
  token: string;
}

export interface ValidateSessionResult {
  banInfo: ActiveBanInfo | null;
  session: SessionData | null;
  valid: boolean;
}
