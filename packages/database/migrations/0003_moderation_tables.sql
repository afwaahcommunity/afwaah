BEGIN;

CREATE TABLE moderation.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES core.anonymous_users(id),
  reporter_session_id UUID REFERENCES core.anonymous_sessions(id),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('message', 'room', 'user')),
  target_message_id UUID,
  target_room_id UUID,
  target_user_id UUID,
  reason VARCHAR(50) NOT NULL
    CHECK (
      reason IN (
        'spam',
        'harassment',
        'hate_speech',
        'threats',
        'illegal_content',
        'impersonation',
        'other'
      )
    ),
  description TEXT,
  evidence_snapshot JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolved_by_admin_id UUID,
  resolution_action VARCHAR(50),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_report_target CHECK (
    (target_type = 'message' AND target_message_id IS NOT NULL)
    OR (target_type = 'room' AND target_room_id IS NOT NULL)
    OR (target_type = 'user' AND target_user_id IS NOT NULL)
  )
);

CREATE INDEX idx_reports_status
  ON moderation.reports(status, created_at DESC);
CREATE INDEX idx_reports_target_user
  ON moderation.reports(target_user_id)
  WHERE target_type = 'user';
CREATE INDEX idx_reports_target_message
  ON moderation.reports(target_message_id)
  WHERE target_type = 'message';
CREATE INDEX idx_reports_reporter
  ON moderation.reports(reporter_user_id);

COMMENT ON TABLE moderation.reports IS 'User-submitted reports for moderation review.';
COMMENT ON COLUMN moderation.reports.evidence_snapshot IS 'JSON snapshot of target state at report time.';

CREATE TABLE moderation.bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID REFERENCES core.anonymous_users(id),
  target_session_id UUID REFERENCES core.anonymous_sessions(id),
  target_room_id UUID REFERENCES core.rooms(id),
  ban_type VARCHAR(30) NOT NULL
    CHECK (ban_type IN ('room_ban', 'global_write_ban', 'global_hard_ban', 'quarantine')),
  confidence_score SMALLINT NOT NULL DEFAULT 100 CHECK (confidence_score BETWEEN 0 AND 100),
  reason TEXT NOT NULL,
  internal_notes TEXT,
  primary_evidence_id UUID,
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_by_admin_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by_admin_id UUID,
  revocation_reason TEXT,
  CONSTRAINT valid_ban_target CHECK (
    target_user_id IS NOT NULL
    OR target_session_id IS NOT NULL
    OR target_room_id IS NOT NULL
  ),
  CONSTRAINT valid_ban_expiry CHECK (
    is_permanent = TRUE OR expires_at IS NOT NULL
  ),
  CONSTRAINT valid_room_ban CHECK (
    ban_type != 'room_ban' OR target_room_id IS NOT NULL
  )
);

CREATE INDEX idx_bans_active_user
  ON moderation.bans(target_user_id)
  WHERE is_active = TRUE;
CREATE INDEX idx_bans_active_session
  ON moderation.bans(target_session_id)
  WHERE is_active = TRUE;
CREATE INDEX idx_bans_room
  ON moderation.bans(target_room_id, target_user_id)
  WHERE ban_type = 'room_ban' AND is_active = TRUE;
CREATE INDEX idx_bans_expiry
  ON moderation.bans(expires_at)
  WHERE is_active = TRUE AND expires_at IS NOT NULL;
CREATE INDEX idx_bans_type
  ON moderation.bans(ban_type)
  WHERE is_active = TRUE;

COMMENT ON TABLE moderation.bans IS 'Ban records with confidence, scope, duration, and reversal support.';
COMMENT ON COLUMN moderation.bans.confidence_score IS 'Zero to 100 confidence that this ban targets the intended identity.';

CREATE TABLE moderation.ban_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_id UUID NOT NULL REFERENCES moderation.bans(id),
  evidence_type VARCHAR(30) NOT NULL
    CHECK (
      evidence_type IN (
        'session_match',
        'device_match',
        'fingerprint_match',
        'ip_match',
        'subnet_match',
        'behavior_pattern',
        'content_similarity',
        'user_report',
        'admin_observation',
        'automated_detection'
      )
    ),
  signal_name VARCHAR(50) NOT NULL,
  signal_value_hash BYTEA,
  signal_value_preview VARCHAR(100),
  match_confidence SMALLINT NOT NULL CHECK (match_confidence BETWEEN 0 AND 100),
  matched_against_ban_id UUID REFERENCES moderation.bans(id),
  description TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ban_evidence_ban
  ON moderation.ban_evidence(ban_id);
CREATE INDEX idx_ban_evidence_type
  ON moderation.ban_evidence(evidence_type);
CREATE INDEX idx_ban_evidence_signal
  ON moderation.ban_evidence(signal_value_hash)
  WHERE signal_value_hash IS NOT NULL;

ALTER TABLE moderation.bans
  ADD CONSTRAINT fk_bans_primary_evidence
  FOREIGN KEY (primary_evidence_id)
  REFERENCES moderation.ban_evidence(id)
  DEFERRABLE INITIALLY DEFERRED;

COMMENT ON TABLE moderation.ban_evidence IS 'Evidence items supporting a ban decision.';

CREATE TABLE moderation.risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type VARCHAR(30) NOT NULL
    CHECK (
      signal_type IN (
        'ip_hash',
        'subnet_hash',
        'device_id_hash',
        'fingerprint_hash',
        'user_agent_hash',
        'asn'
      )
    ),
  signal_value_hash BYTEA NOT NULL,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'unknown'
    CHECK (risk_level IN ('safe', 'low', 'medium', 'high', 'blocked', 'unknown')),
  risk_score SMALLINT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  total_sessions_seen INTEGER NOT NULL DEFAULT 1 CHECK (total_sessions_seen >= 0),
  total_bans_associated INTEGER NOT NULL DEFAULT 0 CHECK (total_bans_associated >= 0),
  is_shared_signal BOOLEAN NOT NULL DEFAULT FALSE,
  concurrent_users_estimate INTEGER CHECK (concurrent_users_estimate IS NULL OR concurrent_users_estimate >= 0),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ban_at TIMESTAMPTZ,
  UNIQUE(signal_type, signal_value_hash)
);

CREATE INDEX idx_risk_signals_lookup
  ON moderation.risk_signals(signal_type, signal_value_hash);
CREATE INDEX idx_risk_signals_high_risk
  ON moderation.risk_signals(risk_level)
  WHERE risk_level IN ('high', 'blocked');
CREATE INDEX idx_risk_signals_shared
  ON moderation.risk_signals(is_shared_signal)
  WHERE is_shared_signal = TRUE;

COMMENT ON TABLE moderation.risk_signals IS 'Aggregated risk data for device and network signals.';
COMMENT ON COLUMN moderation.risk_signals.is_shared_signal IS 'True for broad signals such as campus Wi-Fi that many users may share.';

CREATE TABLE moderation.network_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('ip', 'subnet', 'asn')),
  target_value_hash BYTEA NOT NULL,
  target_value_preview VARCHAR(50),
  restriction_type VARCHAR(30) NOT NULL
    CHECK (
      restriction_type IN (
        'rate_limit_reduced',
        'write_disabled',
        'room_creation_disabled',
        'quarantine_new_sessions'
      )
    ),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  affected_sessions_estimate INTEGER CHECK (affected_sessions_estimate IS NULL OR affected_sessions_estimate >= 0),
  created_by_admin_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_admin_id UUID,
  cancellation_reason TEXT,
  CONSTRAINT valid_cooldown_window CHECK (expires_at > started_at)
);

CREATE INDEX idx_cooldowns_active
  ON moderation.network_cooldowns(target_type, target_value_hash)
  WHERE is_active = TRUE;
CREATE INDEX idx_cooldowns_expiry
  ON moderation.network_cooldowns(expires_at)
  WHERE is_active = TRUE;
CREATE INDEX idx_cooldowns_admin
  ON moderation.network_cooldowns(created_by_admin_id);

COMMENT ON TABLE moderation.network_cooldowns IS 'Temporary network-level restrictions. This is not a permanent IP ban system.';
COMMENT ON COLUMN moderation.network_cooldowns.target_value_preview IS 'Masked value for admin display.';

COMMIT;

