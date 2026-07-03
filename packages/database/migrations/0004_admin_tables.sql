BEGIN;

CREATE TABLE admin.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'moderator'
    CHECK (role IN ('moderator', 'admin', 'super_admin')),
  permissions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_encrypted BYTEA,
  mfa_backup_codes_hash BYTEA[],
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_admin_id UUID REFERENCES admin.admin_users(id),
  deactivated_at TIMESTAMPTZ,
  deactivated_by_admin_id UUID REFERENCES admin.admin_users(id),
  deactivation_reason TEXT
);

CREATE UNIQUE INDEX idx_admin_users_email
  ON admin.admin_users(LOWER(email));
CREATE INDEX idx_admin_users_role
  ON admin.admin_users(role)
  WHERE is_active = TRUE;
CREATE INDEX idx_admin_users_active
  ON admin.admin_users(is_active)
  WHERE is_active = TRUE;

COMMENT ON TABLE admin.admin_users IS 'Real admin accounts for accountable moderation.';
COMMENT ON COLUMN admin.admin_users.permissions IS 'JSON array of permission overrides.';
COMMENT ON COLUMN admin.admin_users.mfa_secret_encrypted IS 'TOTP secret encrypted by the application layer.';

CREATE OR REPLACE FUNCTION admin.check_role_hierarchy(actor_role VARCHAR, target_role VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  IF actor_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  IF actor_role = 'admin' AND target_role = 'moderator' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION admin.get_action_category(action VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  RETURN CASE
    WHEN action IN ('DELETE_MESSAGE', 'HIDE_MESSAGE', 'APPROVE_MESSAGE') THEN 'message_moderation'
    WHEN action IN ('ROOM_BAN', 'GLOBAL_WRITE_BAN', 'GLOBAL_HARD_BAN', 'QUARANTINE', 'UNBAN', 'UPDATE_TRUST_LEVEL', 'RESET_DISPLAY_NAME') THEN 'user_moderation'
    WHEN action IN ('NETWORK_COOLDOWN', 'CANCEL_COOLDOWN') THEN 'network_moderation'
    WHEN action IN ('LOCK_ROOM', 'UNLOCK_ROOM', 'DELETE_ROOM', 'ARCHIVE_ROOM', 'UPDATE_ROOM_SETTINGS') THEN 'room_moderation'
    WHEN action IN ('RESOLVE_REPORT', 'DISMISS_REPORT', 'ESCALATE_REPORT') THEN 'report_handling'
    WHEN action IN ('CREATE_ADMIN', 'UPDATE_ADMIN', 'DEACTIVATE_ADMIN', 'REACTIVATE_ADMIN', 'RESET_ADMIN_PASSWORD') THEN 'admin_management'
    WHEN action IN ('VIEW_USER_PROFILE', 'VIEW_USER_MESSAGES', 'VIEW_USER_SESSIONS', 'EXPORT_DATA', 'SEARCH_USERS') THEN 'data_access'
    WHEN action IN ('UPDATE_RATE_LIMITS', 'UPDATE_GEOFENCE', 'SYSTEM_ANNOUNCEMENT') THEN 'system_config'
    ELSE 'system_config'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TABLE admin.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin.admin_users(id),
  admin_email VARCHAR(255) NOT NULL,
  admin_role VARCHAR(20) NOT NULL,
  action_type VARCHAR(50) NOT NULL
    CHECK (
      action_type IN (
        'DELETE_MESSAGE',
        'HIDE_MESSAGE',
        'APPROVE_MESSAGE',
        'ROOM_BAN',
        'GLOBAL_WRITE_BAN',
        'GLOBAL_HARD_BAN',
        'QUARANTINE',
        'UNBAN',
        'UPDATE_TRUST_LEVEL',
        'RESET_DISPLAY_NAME',
        'NETWORK_COOLDOWN',
        'CANCEL_COOLDOWN',
        'LOCK_ROOM',
        'UNLOCK_ROOM',
        'DELETE_ROOM',
        'ARCHIVE_ROOM',
        'UPDATE_ROOM_SETTINGS',
        'RESOLVE_REPORT',
        'DISMISS_REPORT',
        'ESCALATE_REPORT',
        'CREATE_ADMIN',
        'UPDATE_ADMIN',
        'DEACTIVATE_ADMIN',
        'REACTIVATE_ADMIN',
        'RESET_ADMIN_PASSWORD',
        'VIEW_USER_PROFILE',
        'VIEW_USER_MESSAGES',
        'VIEW_USER_SESSIONS',
        'EXPORT_DATA',
        'SEARCH_USERS',
        'UPDATE_RATE_LIMITS',
        'UPDATE_GEOFENCE',
        'SYSTEM_ANNOUNCEMENT'
      )
    ),
  action_category VARCHAR(30) GENERATED ALWAYS AS (admin.get_action_category(action_type)) STORED,
  target_user_id UUID,
  target_session_id UUID,
  target_room_id UUID,
  target_message_id UUID,
  target_report_id UUID,
  target_ban_id UUID,
  target_admin_id UUID,
  target_cooldown_id UUID,
  reason TEXT,
  internal_notes TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  evidence_snapshot JSONB,
  previous_state JSONB,
  new_state JSONB,
  ip_address INET NOT NULL,
  user_agent TEXT,
  request_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at),
  CHECK (
    action_category IN (
      'message_moderation',
      'user_moderation',
      'network_moderation',
      'room_moderation',
      'report_handling',
      'admin_management',
      'data_access',
      'system_config'
    )
  )
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_audit_log_admin
  ON admin.audit_log(admin_id, created_at DESC);
CREATE INDEX idx_audit_log_action
  ON admin.audit_log(action_type, created_at DESC);
CREATE INDEX idx_audit_log_category
  ON admin.audit_log(action_category, created_at DESC);
CREATE INDEX idx_audit_log_target_user
  ON admin.audit_log(target_user_id, created_at DESC)
  WHERE target_user_id IS NOT NULL;
CREATE INDEX idx_audit_log_target_room
  ON admin.audit_log(target_room_id, created_at DESC)
  WHERE target_room_id IS NOT NULL;
CREATE INDEX idx_audit_log_target_message
  ON admin.audit_log(target_message_id)
  WHERE target_message_id IS NOT NULL;
CREATE INDEX idx_audit_log_time
  ON admin.audit_log(created_at DESC);

COMMENT ON TABLE admin.audit_log IS 'Immutable admin action audit trail partitioned by month.';
COMMENT ON COLUMN admin.audit_log.evidence_snapshot IS 'Relevant target state captured at action time.';
COMMENT ON COLUMN admin.audit_log.previous_state IS 'State before reversible actions.';
COMMENT ON COLUMN admin.audit_log.new_state IS 'State after reversible actions.';

CREATE TABLE admin.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin.admin_users(id),
  token_hash BYTEA NOT NULL UNIQUE,
  refresh_token_hash BYTEA UNIQUE,
  refresh_token_expires_at TIMESTAMPTZ,
  ip_address INET NOT NULL,
  user_agent TEXT,
  device_info JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_mfa_verification BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_verified_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason VARCHAR(100),
  revoked_by_admin_id UUID REFERENCES admin.admin_users(id)
);

CREATE INDEX idx_admin_sessions_admin
  ON admin.admin_sessions(admin_id)
  WHERE is_active = TRUE;
CREATE INDEX idx_admin_sessions_token
  ON admin.admin_sessions(token_hash)
  WHERE is_active = TRUE;
CREATE INDEX idx_admin_sessions_refresh
  ON admin.admin_sessions(refresh_token_hash)
  WHERE is_active = TRUE AND refresh_token_hash IS NOT NULL;
CREATE INDEX idx_admin_sessions_expiry
  ON admin.admin_sessions(expires_at)
  WHERE is_active = TRUE;
CREATE INDEX idx_admin_sessions_activity
  ON admin.admin_sessions(last_active_at DESC)
  WHERE is_active = TRUE;

COMMENT ON TABLE admin.admin_sessions IS 'Admin authentication sessions with security tracking.';
COMMENT ON COLUMN admin.admin_sessions.requires_mfa_verification IS 'True when sensitive actions require MFA confirmation.';

COMMIT;

