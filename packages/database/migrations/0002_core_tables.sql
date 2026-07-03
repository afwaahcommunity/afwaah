BEGIN;

CREATE TABLE core.anonymous_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_display_name VARCHAR(50) NOT NULL,
  trust_level SMALLINT NOT NULL DEFAULT 50 CHECK (trust_level BETWEEN 0 AND 100),
  risk_score SMALLINT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'quarantined', 'write_banned', 'hard_banned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_messages_sent INTEGER NOT NULL DEFAULT 0,
  total_rooms_created INTEGER NOT NULL DEFAULT 0,
  total_reports_received INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_anonymous_users_status
  ON core.anonymous_users(status)
  WHERE status != 'active';
CREATE INDEX idx_anonymous_users_last_seen
  ON core.anonymous_users(last_seen_at);
CREATE INDEX idx_anonymous_users_risk
  ON core.anonymous_users(risk_score)
  WHERE risk_score > 50;

COMMENT ON TABLE core.anonymous_users IS 'Internal anonymous user identities. These IDs are never exposed to normal users.';
COMMENT ON COLUMN core.anonymous_users.trust_level IS 'Higher means more trusted. Used for rate-limit and capability modifiers.';
COMMENT ON COLUMN core.anonymous_users.risk_score IS 'Higher means more suspicious. Computed from moderation signals.';

CREATE TABLE core.anonymous_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  token_hash BYTEA NOT NULL UNIQUE,
  device_install_id_hash BYTEA,
  fingerprint_hash BYTEA,
  user_agent_hash BYTEA NOT NULL,
  ip_hash BYTEA NOT NULL,
  ip_subnet_hash BYTEA,
  asn VARCHAR(20),
  last_known_lat DECIMAL(9, 6),
  last_known_lng DECIMAL(9, 6),
  last_location_check_at TIMESTAMPTZ,
  location_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revocation_reason VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_session_location CHECK (
    (last_known_lat IS NULL AND last_known_lng IS NULL)
    OR (last_known_lat IS NOT NULL AND last_known_lng IS NOT NULL)
  )
);

CREATE INDEX idx_sessions_user
  ON core.anonymous_sessions(anonymous_user_id);
CREATE INDEX idx_sessions_token
  ON core.anonymous_sessions(token_hash)
  WHERE is_active = TRUE;
CREATE INDEX idx_sessions_device
  ON core.anonymous_sessions(device_install_id_hash)
  WHERE device_install_id_hash IS NOT NULL;
CREATE INDEX idx_sessions_fingerprint
  ON core.anonymous_sessions(fingerprint_hash)
  WHERE fingerprint_hash IS NOT NULL;
CREATE INDEX idx_sessions_ip
  ON core.anonymous_sessions(ip_hash);
CREATE INDEX idx_sessions_active
  ON core.anonymous_sessions(is_active, last_seen_at);

COMMENT ON TABLE core.anonymous_sessions IS 'Individual browser/device sessions linked to anonymous users.';
COMMENT ON COLUMN core.anonymous_sessions.token_hash IS 'SHA-256 hash of the secure HTTP-only session token.';

CREATE TABLE core.display_name_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  display_name VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  change_reason VARCHAR(20) DEFAULT 'user_change'
    CHECK (change_reason IN ('initial', 'user_change', 'admin_reset', 'policy_violation')),
  changed_by_admin_id UUID,
  session_id UUID REFERENCES core.anonymous_sessions(id)
);

CREATE INDEX idx_display_name_user
  ON core.display_name_history(anonymous_user_id, started_at DESC);
CREATE INDEX idx_display_name_active
  ON core.display_name_history(anonymous_user_id)
  WHERE ended_at IS NULL;
CREATE INDEX idx_display_name_search
  ON core.display_name_history
  USING gin(display_name gin_trgm_ops);

COMMENT ON TABLE core.display_name_history IS 'Audit trail of display name changes for immutable message attribution.';

CREATE TABLE core.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  room_type VARCHAR(20) NOT NULL DEFAULT 'public'
    CHECK (room_type IN ('public', 'private', 'announcement')),
  invite_code VARCHAR(20) UNIQUE,
  invite_code_expires_at TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  created_by_session_id UUID REFERENCES core.anonymous_sessions(id),
  max_participants INTEGER DEFAULT 500,
  allow_images BOOLEAN NOT NULL DEFAULT TRUE,
  allow_links BOOLEAN NOT NULL DEFAULT TRUE,
  slow_mode_seconds INTEGER DEFAULT 0 CHECK (slow_mode_seconds >= 0),
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted', 'locked')),
  locked_reason TEXT,
  locked_by_admin_id UUID,
  participant_count INTEGER NOT NULL DEFAULT 0 CHECK (participant_count >= 0),
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  custom_geofence_lat DECIMAL(9, 6),
  custom_geofence_lng DECIMAL(9, 6),
  custom_geofence_radius_km DECIMAL(5, 2),
  CONSTRAINT valid_room_geofence CHECK (
    (
      custom_geofence_lat IS NULL
      AND custom_geofence_lng IS NULL
      AND custom_geofence_radius_km IS NULL
    )
    OR (
      custom_geofence_lat IS NOT NULL
      AND custom_geofence_lng IS NOT NULL
      AND custom_geofence_radius_km IS NOT NULL
      AND custom_geofence_radius_km > 0
    )
  )
);

CREATE INDEX idx_rooms_status
  ON core.rooms(status)
  WHERE status = 'active';
CREATE INDEX idx_rooms_type_status
  ON core.rooms(room_type, status);
CREATE INDEX idx_rooms_last_activity
  ON core.rooms(last_message_at DESC NULLS LAST)
  WHERE status = 'active';
CREATE INDEX idx_rooms_invite
  ON core.rooms(invite_code)
  WHERE invite_code IS NOT NULL AND status = 'active';
CREATE INDEX idx_rooms_expiry
  ON core.rooms(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'active';
CREATE INDEX idx_rooms_creator
  ON core.rooms(created_by_user_id);

COMMENT ON TABLE core.rooms IS 'Public and private chat rooms.';
COMMENT ON COLUMN core.rooms.slow_mode_seconds IS 'Minimum seconds between messages per user. Zero means disabled.';

CREATE TABLE core.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES core.rooms(id) ON DELETE CASCADE,
  anonymous_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'moderator', 'creator')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'left', 'kicked', 'banned')),
  banned_at TIMESTAMPTZ,
  banned_reason TEXT,
  banned_by_admin_id UUID,
  ban_expires_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(room_id, anonymous_user_id)
);

CREATE INDEX idx_participants_room
  ON core.room_participants(room_id)
  WHERE status = 'active';
CREATE INDEX idx_participants_user
  ON core.room_participants(anonymous_user_id, status);
CREATE INDEX idx_participants_banned
  ON core.room_participants(room_id, anonymous_user_id)
  WHERE status = 'banned';
CREATE INDEX idx_participants_ban_expiry
  ON core.room_participants(ban_expires_at)
  WHERE ban_expires_at IS NOT NULL AND status = 'banned';

COMMENT ON TABLE core.room_participants IS 'Room membership plus room-level ban state.';

CREATE TABLE core.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  client_message_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES core.rooms(id),
  anonymous_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  session_id UUID NOT NULL REFERENCES core.anonymous_sessions(id),
  display_name_snapshot VARCHAR(50) NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 4000),
  body_type VARCHAR(20) NOT NULL DEFAULT 'text'
    CHECK (body_type IN ('text', 'image', 'system')),
  media_asset_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'deleted', 'moderation_pending', 'moderation_hidden')),
  deleted_at TIMESTAMPTZ,
  deleted_by_admin_id UUID,
  deletion_reason TEXT,
  reply_to_message_id UUID,
  reaction_counts JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_messages_room_time
  ON core.messages(room_id, created_at DESC);
CREATE INDEX idx_messages_user
  ON core.messages(anonymous_user_id, created_at DESC);
CREATE INDEX idx_messages_status
  ON core.messages(status)
  WHERE status != 'visible';
CREATE INDEX idx_messages_reply
  ON core.messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX idx_messages_dedup
  ON core.messages(room_id, client_message_id, created_at DESC);

COMMENT ON TABLE core.messages IS 'Chat messages partitioned by creation month.';
COMMENT ON COLUMN core.messages.display_name_snapshot IS 'Immutable display name copy from send time.';
COMMENT ON COLUMN core.messages.client_message_id IS 'Client-generated UUID for optimistic UI and app-level deduplication.';

CREATE TABLE core.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  anonymous_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  emoji VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, anonymous_user_id, emoji)
);

CREATE INDEX idx_reactions_message
  ON core.message_reactions(message_id);
CREATE INDEX idx_reactions_user
  ON core.message_reactions(anonymous_user_id);

COMMENT ON TABLE core.message_reactions IS 'Emoji reactions on messages. Message FK is intentionally app-enforced because messages are partitioned.';

CREATE TABLE core.location_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES core.anonymous_sessions(id),
  anonymous_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  latitude DECIMAL(9, 6) NOT NULL,
  longitude DECIMAL(9, 6) NOT NULL,
  accuracy_meters DECIMAL(10, 2),
  is_within_geofence BOOLEAN NOT NULL,
  distance_from_center_km DECIMAL(10, 3),
  geofence_center_lat DECIMAL(9, 6) NOT NULL,
  geofence_center_lng DECIMAL(9, 6) NOT NULL,
  geofence_radius_km DECIMAL(5, 2) NOT NULL,
  verification_method VARCHAR(30) NOT NULL DEFAULT 'browser_geolocation'
    CHECK (verification_method IN ('browser_geolocation', 'ip_geolocation', 'manual_override')),
  confidence_score SMALLINT NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_location_checks_session
  ON core.location_checks(session_id, created_at DESC);
CREATE INDEX idx_location_checks_valid
  ON core.location_checks(session_id, valid_until)
  WHERE is_within_geofence = TRUE;

COMMENT ON TABLE core.location_checks IS 'Location verification records used for geofence write access.';

CREATE TABLE core.geofence_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  center_latitude DECIMAL(9, 6) NOT NULL,
  center_longitude DECIMAL(9, 6) NOT NULL,
  radius_km DECIMAL(5, 2) NOT NULL CHECK (radius_km > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geofence_active
  ON core.geofence_config(is_active)
  WHERE is_active = TRUE;
CREATE UNIQUE INDEX uniq_geofence_default
  ON core.geofence_config(is_default)
  WHERE is_default = TRUE;

COMMENT ON TABLE core.geofence_config IS 'Campus geofence definitions.';

CREATE TABLE core.rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL UNIQUE
    CHECK (
      action_type IN (
        'message_send',
        'message_burst',
        'room_create',
        'display_name_change',
        'image_upload',
        'report_create',
        'reaction_add',
        'room_join'
      )
    ),
  max_requests INTEGER NOT NULL CHECK (max_requests > 0),
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  burst_max INTEGER CHECK (burst_max IS NULL OR burst_max > 0),
  burst_window_seconds INTEGER CHECK (burst_window_seconds IS NULL OR burst_window_seconds > 0),
  trust_multipliers JSONB NOT NULL DEFAULT '{"0": 0.5, "50": 1.0, "100": 2.0}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE core.rate_limit_config IS 'Configurable rate limits. Runtime enforcement belongs in Redis.';

COMMIT;

