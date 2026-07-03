BEGIN;

CREATE TABLE media.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  uploaded_by_session_id UUID NOT NULL REFERENCES core.anonymous_sessions(id),
  original_filename VARCHAR(255),
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_provider VARCHAR(20) NOT NULL DEFAULT 'local'
    CHECK (storage_provider IN ('local', 's3', 'r2', 'gcs', 'cloudinary')),
  storage_key VARCHAR(500) NOT NULL UNIQUE,
  storage_bucket VARCHAR(100),
  storage_region VARCHAR(50),
  public_url TEXT,
  cdn_url TEXT,
  signed_url_expires_at TIMESTAMPTZ,
  width INTEGER,
  height INTEGER,
  dominant_color VARCHAR(7),
  blur_hash VARCHAR(100),
  thumbnail_url TEXT,
  thumbnail_storage_key VARCHAR(500),
  thumbnail_width INTEGER,
  thumbnail_height INTEGER,
  content_hash BYTEA NOT NULL,
  perceptual_hash BYTEA,
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged', 'auto_approved')),
  moderation_labels JSONB DEFAULT '[]',
  moderation_confidence SMALLINT CHECK (moderation_confidence IS NULL OR moderation_confidence BETWEEN 0 AND 100),
  moderation_notes TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by_admin_id UUID,
  auto_moderation_result JSONB,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  last_used_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'processing'
    CHECK (status IN ('uploading', 'processing', 'active', 'deleted', 'quarantined')),
  processing_error TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by_admin_id UUID,
  deletion_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_image_dimensions CHECK (
    (mime_type NOT LIKE 'image/%')
    OR (width IS NOT NULL AND height IS NOT NULL)
  ),
  CONSTRAINT valid_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800)
);

CREATE INDEX idx_media_assets_uploader
  ON media.media_assets(uploaded_by_user_id, created_at DESC);
CREATE INDEX idx_media_assets_session
  ON media.media_assets(uploaded_by_session_id);
CREATE INDEX idx_media_assets_content_hash
  ON media.media_assets(content_hash);
CREATE INDEX idx_media_assets_perceptual_hash
  ON media.media_assets(perceptual_hash)
  WHERE perceptual_hash IS NOT NULL;
CREATE INDEX idx_media_assets_moderation
  ON media.media_assets(moderation_status, created_at DESC)
  WHERE moderation_status IN ('pending', 'flagged');
CREATE INDEX idx_media_assets_status
  ON media.media_assets(status)
  WHERE status = 'active';
CREATE INDEX idx_media_assets_cleanup
  ON media.media_assets(created_at)
  WHERE status = 'processing' OR (status = 'active' AND usage_count = 0);

COMMENT ON TABLE media.media_assets IS 'Uploaded media files with moderation and storage tracking.';
COMMENT ON COLUMN media.media_assets.content_hash IS 'SHA-256 hash for deduplication and abuse detection.';
COMMENT ON COLUMN media.media_assets.perceptual_hash IS 'Image pHash for similar-image abuse detection.';
COMMENT ON COLUMN media.media_assets.blur_hash IS 'BlurHash placeholder for image rendering.';

CREATE TABLE media.upload_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  session_id UUID NOT NULL REFERENCES core.anonymous_sessions(id),
  token_hash BYTEA NOT NULL UNIQUE,
  allowed_mime_types TEXT[] NOT NULL DEFAULT ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  max_file_size_bytes BIGINT NOT NULL DEFAULT 10485760 CHECK (max_file_size_bytes > 0),
  target_room_id UUID REFERENCES core.rooms(id),
  upload_purpose VARCHAR(30) NOT NULL DEFAULT 'message_attachment'
    CHECK (upload_purpose IN ('message_attachment', 'room_avatar', 'profile_avatar')),
  presigned_url TEXT,
  presigned_url_expires_at TIMESTAMPTZ,
  upload_key VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploading', 'used', 'expired', 'cancelled', 'failed')),
  resulting_asset_id UUID REFERENCES media.media_assets(id),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  client_filename VARCHAR(255),
  client_mime_type VARCHAR(100),
  client_file_size BIGINT,
  CONSTRAINT valid_upload_token_window CHECK (expires_at > created_at)
);

CREATE INDEX idx_upload_tokens_token
  ON media.upload_tokens(token_hash)
  WHERE status = 'pending';
CREATE INDEX idx_upload_tokens_user
  ON media.upload_tokens(anonymous_user_id, created_at DESC);
CREATE INDEX idx_upload_tokens_session
  ON media.upload_tokens(session_id, created_at DESC);
CREATE INDEX idx_upload_tokens_expiry
  ON media.upload_tokens(expires_at)
  WHERE status IN ('pending', 'uploading');
CREATE INDEX idx_upload_tokens_room
  ON media.upload_tokens(target_room_id)
  WHERE target_room_id IS NOT NULL;
CREATE INDEX idx_upload_tokens_cleanup
  ON media.upload_tokens(created_at)
  WHERE status IN ('pending', 'uploading', 'expired');

COMMENT ON TABLE media.upload_tokens IS 'Pre-signed direct-upload tokens for media uploads.';
COMMENT ON COLUMN media.upload_tokens.presigned_url IS 'Pre-signed object-storage URL generated by the application layer.';

ALTER TABLE core.messages
  ADD CONSTRAINT fk_messages_media_asset
  FOREIGN KEY (media_asset_id)
  REFERENCES media.media_assets(id);

COMMIT;

