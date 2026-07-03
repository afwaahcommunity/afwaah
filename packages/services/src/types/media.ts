import type {
  MediaStatus,
  ModerationStatus,
  UploadPurpose,
  UploadTokenStatus,
} from "./common";

export interface CreateUploadTokenInput {
  allowedMimeTypes?: string[];
  clientFileSize?: number;
  clientFilename?: string;
  clientMimeType?: string;
  expiresAt: Date;
  maxFileSizeBytes?: number;
  targetRoomId?: string;
  token: string;
  uploadPurpose?: UploadPurpose;
}

export interface UploadTokenData {
  allowedMimeTypes: string[];
  createdAt: Date;
  expiresAt: Date;
  id: string;
  maxFileSizeBytes: number;
  sessionId: string;
  status: UploadTokenStatus;
  targetRoomId: string | null;
  uploadPurpose: UploadPurpose;
  userId: string;
}

export interface CreateMediaAssetInput {
  contentHash: Buffer;
  fileSizeBytes: number;
  height?: number;
  mimeType: string;
  originalFilename?: string;
  storageKey: string;
  storageProvider?: string;
  width?: number;
}

export interface MediaAssetData {
  createdAt: Date;
  fileSizeBytes: number;
  id: string;
  mimeType: string;
  moderationStatus: ModerationStatus;
  originalFilename: string | null;
  status: MediaStatus;
  storageKey: string;
  uploadedBySessionId: string;
  uploadedByUserId: string;
}
