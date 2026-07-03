import { mediaAssets, uploadTokens } from "../schema/media";

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;

export type UploadToken = typeof uploadTokens.$inferSelect;
export type NewUploadToken = typeof uploadTokens.$inferInsert;
