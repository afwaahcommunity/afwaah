import { RateLimitCache, type RedisClient } from "../cache";
import { createError } from "../errors";
import { MediaRepository, type DrizzleClient } from "../repositories";
import type {
  CreateMediaAssetInput,
  CreateUploadTokenInput,
  MediaAssetData,
  Result,
  UploadTokenData,
} from "../types";
import { err, ok } from "../types";
import { hashToken } from "../utils";
import { WriteGuardService } from "./write-guard.service";

export class MediaService {
  private readonly mediaRepo: MediaRepository;
  private readonly rateLimitCache: RateLimitCache;
  private readonly writeGuard: WriteGuardService;

  constructor(db: DrizzleClient, redis: RedisClient) {
    this.mediaRepo = new MediaRepository(db);
    this.rateLimitCache = new RateLimitCache(redis);
    this.writeGuard = new WriteGuardService(db);
  }

  async createAsset(
    userId: string,
    sessionId: string,
    input: CreateMediaAssetInput,
  ): Promise<Result<MediaAssetData>> {
    const assetError = validateAssetInput(input);
    if (assetError) return err(createError("VALIDATION_ERROR", assetError));

    const writeAccess = await this.writeGuard.requireWriteAccess({
      sessionId,
      userId,
    });
    if (!writeAccess.ok) return err(writeAccess.error);

    const asset = await this.mediaRepo.createAsset(userId, sessionId, input);
    return ok(mapAsset(asset));
  }

  async createUploadToken(
    userId: string,
    sessionId: string,
    input: CreateUploadTokenInput,
  ): Promise<Result<UploadTokenData>> {
    const tokenError = validateUploadTokenInput(input);
    if (tokenError) return err(createError("VALIDATION_ERROR", tokenError));

    const writeAccess = await this.writeGuard.requireWriteAccess({
      roomId: input.targetRoomId,
      sessionId,
      userId,
    });
    if (!writeAccess.ok) return err(writeAccess.error);

    const limit = await this.rateLimitCache.checkWithBurst(
      "image_upload",
      userId,
      {
        burstMax: 3,
        burstWindowSeconds: 60,
        maxRequests: 10,
        windowSeconds: 3600,
      },
    );
    if (!limit.allowed)
      return err(createError("RATE_LIMITED", "Upload rate limited."));

    const token = await this.mediaRepo.createUploadToken(
      userId,
      sessionId,
      hashToken(input.token),
      input,
    );
    return ok(mapUploadToken(token));
  }

  async getAsset(assetId: string): Promise<Result<MediaAssetData>> {
    const asset = await this.mediaRepo.findAssetById(assetId);
    return asset
      ? ok(mapAsset(asset))
      : err(createError("MEDIA_NOT_FOUND", "Media asset not found."));
  }
}

function mapAsset(asset: {
  createdAt: Date;
  fileSizeBytes: number;
  id: string;
  mimeType: string;
  moderationStatus: string;
  originalFilename: string | null;
  status: string;
  storageKey: string;
  uploadedBySessionId: string;
  uploadedByUserId: string;
}): MediaAssetData {
  return {
    createdAt: asset.createdAt,
    fileSizeBytes: asset.fileSizeBytes,
    id: asset.id,
    mimeType: asset.mimeType,
    moderationStatus:
      asset.moderationStatus as MediaAssetData["moderationStatus"],
    originalFilename: asset.originalFilename,
    status: asset.status as MediaAssetData["status"],
    storageKey: asset.storageKey,
    uploadedBySessionId: asset.uploadedBySessionId,
    uploadedByUserId: asset.uploadedByUserId,
  };
}

const MAX_ASSET_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

function validateAssetInput(input: CreateMediaAssetInput): string | null {
  if (!input.storageKey.trim()) return "storageKey is required.";
  if (input.storageKey.length > 500) return "storageKey is too long.";
  if (!input.mimeType.trim()) return "mimeType is required.";
  if (input.mimeType.length > 100) return "mimeType is too long.";
  if (input.originalFilename && input.originalFilename.length > 255) {
    return "originalFilename is too long.";
  }
  if (input.contentHash.length === 0) return "contentHash is required.";
  if (
    !Number.isFinite(input.fileSizeBytes) ||
    input.fileSizeBytes <= 0 ||
    input.fileSizeBytes > MAX_ASSET_FILE_SIZE_BYTES
  ) {
    return "fileSizeBytes must be between 1 byte and 50 MB.";
  }
  if (input.mimeType.startsWith("image/")) {
    if (!input.width || !input.height) {
      return "Image assets require width and height.";
    }
  }
  if (
    (input.width !== undefined &&
      (!Number.isInteger(input.width) || input.width <= 0)) ||
    (input.height !== undefined &&
      (!Number.isInteger(input.height) || input.height <= 0))
  ) {
    return "Image dimensions must be positive integers.";
  }

  return null;
}

function validateUploadTokenInput(
  input: CreateUploadTokenInput,
): string | null {
  const allowedMimeTypes =
    input.allowedMimeTypes ?? DEFAULT_ALLOWED_IMAGE_MIME_TYPES;
  const maxFileSizeBytes = input.maxFileSizeBytes ?? MAX_UPLOAD_FILE_SIZE_BYTES;

  if (!input.token.trim()) return "Upload token is required.";
  if (input.expiresAt <= new Date()) {
    return "Upload token expiry must be in the future.";
  }
  if (
    !Number.isFinite(maxFileSizeBytes) ||
    maxFileSizeBytes <= 0 ||
    maxFileSizeBytes > MAX_ASSET_FILE_SIZE_BYTES
  ) {
    return "maxFileSizeBytes must be between 1 byte and 50 MB.";
  }
  if (input.clientFileSize !== undefined) {
    if (
      !Number.isFinite(input.clientFileSize) ||
      input.clientFileSize <= 0 ||
      input.clientFileSize > maxFileSizeBytes
    ) {
      return "clientFileSize exceeds the allowed upload size.";
    }
  }
  if (allowedMimeTypes.length === 0) {
    return "At least one allowed MIME type is required.";
  }
  if (
    allowedMimeTypes.some(
      (mimeType) =>
        !mimeType.trim() || mimeType.length > 100 || !mimeType.includes("/"),
    )
  ) {
    return "Allowed MIME types must be valid MIME strings.";
  }
  if (
    input.clientMimeType &&
    !allowedMimeTypes.includes(input.clientMimeType)
  ) {
    return "clientMimeType is not allowed.";
  }
  if (input.clientFilename && input.clientFilename.length > 255) {
    return "clientFilename is too long.";
  }

  return null;
}

function mapUploadToken(token: {
  allowedMimeTypes: string[];
  anonymousUserId: string;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  maxFileSizeBytes: number;
  sessionId: string;
  status: string;
  targetRoomId: string | null;
  uploadPurpose: string;
}): UploadTokenData {
  return {
    allowedMimeTypes: token.allowedMimeTypes,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    id: token.id,
    maxFileSizeBytes: token.maxFileSizeBytes,
    sessionId: token.sessionId,
    status: token.status as UploadTokenData["status"],
    targetRoomId: token.targetRoomId,
    uploadPurpose: token.uploadPurpose as UploadTokenData["uploadPurpose"],
    userId: token.anonymousUserId,
  };
}
