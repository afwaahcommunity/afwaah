import { mediaAssets, uploadTokens } from "@campus-chat/database/schema";
import type { MediaAsset, UploadToken } from "@campus-chat/database/models";
import { eq } from "drizzle-orm";

import type { CreateMediaAssetInput, CreateUploadTokenInput } from "../types";
import { BaseRepository, type DrizzleClient } from "./base";

export class MediaRepository extends BaseRepository {
  constructor(db: DrizzleClient) {
    super(db);
  }

  async createAsset(
    userId: string,
    sessionId: string,
    input: CreateMediaAssetInput,
  ): Promise<MediaAsset> {
    const [asset] = await this.db
      .insert(mediaAssets)
      .values({
        contentHash: input.contentHash,
        fileSizeBytes: input.fileSizeBytes,
        height: input.height,
        mimeType: input.mimeType,
        originalFilename: input.originalFilename,
        status: "active",
        storageKey: input.storageKey,
        storageProvider: input.storageProvider ?? "local",
        uploadedBySessionId: sessionId,
        uploadedByUserId: userId,
        width: input.width,
      })
      .returning();

    if (!asset) throw new Error("Failed to create media asset.");
    return asset;
  }

  async createUploadToken(
    userId: string,
    sessionId: string,
    tokenHash: Buffer,
    input: CreateUploadTokenInput,
  ): Promise<UploadToken> {
    const [token] = await this.db
      .insert(uploadTokens)
      .values({
        allowedMimeTypes: input.allowedMimeTypes,
        anonymousUserId: userId,
        clientFileSize: input.clientFileSize,
        clientFilename: input.clientFilename,
        clientMimeType: input.clientMimeType,
        expiresAt: input.expiresAt,
        maxFileSizeBytes: input.maxFileSizeBytes,
        sessionId,
        targetRoomId: input.targetRoomId,
        tokenHash,
        uploadPurpose: input.uploadPurpose ?? "message_attachment",
      })
      .returning();

    if (!token) throw new Error("Failed to create upload token.");
    return token;
  }

  async findAssetById(assetId: string): Promise<MediaAsset | null> {
    const [asset] = await this.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId))
      .limit(1);

    return asset ?? null;
  }

  async findUploadTokenByHash(tokenHash: Buffer): Promise<UploadToken | null> {
    const [token] = await this.db
      .select()
      .from(uploadTokens)
      .where(eq(uploadTokens.tokenHash, tokenHash))
      .limit(1);

    return token ?? null;
  }
}
