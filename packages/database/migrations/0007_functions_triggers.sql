BEGIN;

CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_geofence_config_updated_at
  BEFORE UPDATE ON core.geofence_config
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

CREATE OR REPLACE FUNCTION core.update_user_message_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE core.anonymous_users
  SET
    total_messages_sent = total_messages_sent + 1,
    last_seen_at = NOW()
  WHERE id = NEW.anonymous_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_message_stats
  AFTER INSERT ON core.messages
  FOR EACH ROW
  EXECUTE FUNCTION core.update_user_message_stats();

CREATE OR REPLACE FUNCTION core.update_user_room_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE core.anonymous_users
  SET total_rooms_created = total_rooms_created + 1
  WHERE id = NEW.created_by_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_room_stats
  AFTER INSERT ON core.rooms
  FOR EACH ROW
  EXECUTE FUNCTION core.update_user_room_stats();

CREATE OR REPLACE FUNCTION moderation.update_user_report_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_type = 'user' AND NEW.target_user_id IS NOT NULL THEN
    UPDATE core.anonymous_users
    SET total_reports_received = total_reports_received + 1
    WHERE id = NEW.target_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_report_stats
  AFTER INSERT ON moderation.reports
  FOR EACH ROW
  EXECUTE FUNCTION moderation.update_user_report_stats();

CREATE OR REPLACE FUNCTION core.update_room_message_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE core.rooms
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at
  WHERE id = NEW.room_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_room_message_stats
  AFTER INSERT ON core.messages
  FOR EACH ROW
  EXECUTE FUNCTION core.update_room_message_stats();

CREATE OR REPLACE FUNCTION core.update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE core.rooms
    SET participant_count = participant_count + 1
    WHERE id = NEW.room_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE core.rooms
      SET participant_count = GREATEST(0, participant_count - 1)
      WHERE id = NEW.room_id;
    ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE core.rooms
      SET participant_count = participant_count + 1
      WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    UPDATE core.rooms
    SET participant_count = GREATEST(0, participant_count - 1)
    WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_room_participant_count
  AFTER INSERT OR UPDATE OR DELETE ON core.room_participants
  FOR EACH ROW
  EXECUTE FUNCTION core.update_room_participant_count();

CREATE OR REPLACE FUNCTION core.create_initial_display_name()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO core.display_name_history (
    anonymous_user_id,
    display_name,
    change_reason
  )
  VALUES (
    NEW.id,
    NEW.current_display_name,
    'initial'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_initial_display_name
  AFTER INSERT ON core.anonymous_users
  FOR EACH ROW
  EXECUTE FUNCTION core.create_initial_display_name();

CREATE OR REPLACE FUNCTION core.track_display_name_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_display_name IS DISTINCT FROM NEW.current_display_name THEN
    UPDATE core.display_name_history
    SET ended_at = NOW()
    WHERE anonymous_user_id = NEW.id
      AND ended_at IS NULL;

    INSERT INTO core.display_name_history (
      anonymous_user_id,
      display_name,
      change_reason
    )
    VALUES (
      NEW.id,
      NEW.current_display_name,
      'user_change'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_track_display_name_change
  AFTER UPDATE OF current_display_name ON core.anonymous_users
  FOR EACH ROW
  EXECUTE FUNCTION core.track_display_name_change();

CREATE OR REPLACE FUNCTION core.update_reaction_counts()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE core.messages
    SET reaction_counts = COALESCE(reaction_counts, '{}'::JSONB)
      || jsonb_build_object(
        NEW.emoji,
        COALESCE((reaction_counts ->> NEW.emoji)::INTEGER, 0) + 1
      )
    WHERE id = NEW.message_id;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE((reaction_counts ->> OLD.emoji)::INTEGER, 0)
    INTO current_count
    FROM core.messages
    WHERE id = OLD.message_id
    LIMIT 1;

    UPDATE core.messages
    SET reaction_counts = CASE
      WHEN COALESCE(current_count, 0) <= 1 THEN reaction_counts - OLD.emoji
      ELSE reaction_counts || jsonb_build_object(OLD.emoji, current_count - 1)
    END
    WHERE id = OLD.message_id;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_reaction_counts
  AFTER INSERT OR DELETE ON core.message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION core.update_reaction_counts();

CREATE OR REPLACE FUNCTION moderation.check_active_ban(
  p_user_id UUID,
  p_session_id UUID DEFAULT NULL,
  p_room_id UUID DEFAULT NULL
)
RETURNS TABLE (
  ban_id UUID,
  ban_type VARCHAR(30),
  confidence_score SMALLINT,
  reason TEXT,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.ban_type,
    b.confidence_score,
    b.reason,
    b.expires_at
  FROM moderation.bans b
  WHERE b.is_active = TRUE
    AND (b.expires_at IS NULL OR b.expires_at > NOW())
    AND (
      b.target_user_id = p_user_id
      OR (p_session_id IS NOT NULL AND b.target_session_id = p_session_id)
    )
    AND (
      p_room_id IS NULL
      OR b.ban_type != 'room_ban'
      OR b.target_room_id = p_room_id
    )
  ORDER BY
    CASE b.ban_type
      WHEN 'global_hard_ban' THEN 1
      WHEN 'global_write_ban' THEN 2
      WHEN 'quarantine' THEN 3
      WHEN 'room_ban' THEN 4
      ELSE 5
    END,
    b.confidence_score DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION moderation.check_active_ban IS 'Returns the most severe active ban for a user/session and optional room.';

CREATE OR REPLACE FUNCTION moderation.calculate_session_risk_score(
  p_session_id UUID
)
RETURNS TABLE (
  total_risk_score SMALLINT,
  risk_breakdown JSONB
) AS $$
DECLARE
  v_ip_risk SMALLINT := 0;
  v_device_risk SMALLINT := 0;
  v_fingerprint_risk SMALLINT := 0;
  v_behavior_risk SMALLINT := 0;
  v_session core.anonymous_sessions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_session
  FROM core.anonymous_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::SMALLINT, '{}'::JSONB;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(risk_score), 0)::SMALLINT
  INTO v_ip_risk
  FROM moderation.risk_signals
  WHERE signal_type = 'ip_hash'
    AND signal_value_hash = v_session.ip_hash;

  IF v_session.device_install_id_hash IS NOT NULL THEN
    SELECT COALESCE(MAX(risk_score), 0)::SMALLINT
    INTO v_device_risk
    FROM moderation.risk_signals
    WHERE signal_type = 'device_id_hash'
      AND signal_value_hash = v_session.device_install_id_hash;
  END IF;

  IF v_session.fingerprint_hash IS NOT NULL THEN
    SELECT COALESCE(MAX(risk_score), 0)::SMALLINT
    INTO v_fingerprint_risk
    FROM moderation.risk_signals
    WHERE signal_type = 'fingerprint_hash'
      AND signal_value_hash = v_session.fingerprint_hash;
  END IF;

  RETURN QUERY SELECT
    LEAST(
      100,
      ROUND(
        (v_ip_risk * 0.2)
        + (v_device_risk * 0.4)
        + (v_fingerprint_risk * 0.3)
        + (v_behavior_risk * 0.1)
      )::INTEGER
    )::SMALLINT,
    jsonb_build_object(
      'ip_risk', v_ip_risk,
      'device_risk', v_device_risk,
      'fingerprint_risk', v_fingerprint_risk,
      'behavior_risk', v_behavior_risk
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION moderation.calculate_session_risk_score IS 'Calculates a composite risk score from privacy-preserving session signals.';

CREATE OR REPLACE FUNCTION admin.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE admin.admin_sessions
  SET
    is_active = FALSE,
    revoked_at = NOW(),
    revocation_reason = 'expired'
  WHERE is_active = TRUE
    AND expires_at < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION admin.cleanup_expired_sessions IS 'Marks expired admin sessions inactive.';

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON admin.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

CREATE OR REPLACE FUNCTION media.find_duplicate_content(p_content_hash BYTEA)
RETURNS TABLE (
  asset_id UUID,
  upload_count INTEGER,
  first_uploaded_at TIMESTAMPTZ,
  is_flagged BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH duplicate_stats AS (
    SELECT
      content_hash,
      COUNT(*)::INTEGER AS upload_count,
      MIN(created_at) AS first_uploaded_at,
      BOOL_OR(moderation_status IN ('rejected', 'flagged')) AS is_flagged
    FROM media.media_assets
    WHERE content_hash = p_content_hash
      AND status != 'deleted'
    GROUP BY content_hash
  )
  SELECT
    m.id,
    s.upload_count,
    s.first_uploaded_at,
    s.is_flagged
  FROM media.media_assets m
  JOIN duplicate_stats s ON s.content_hash = m.content_hash
  WHERE m.content_hash = p_content_hash
    AND m.status != 'deleted'
  ORDER BY m.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION media.find_duplicate_content IS 'Finds an existing active asset with the same content hash.';

CREATE OR REPLACE FUNCTION media.consume_upload_token(
  p_token_hash BYTEA,
  p_mime_type VARCHAR,
  p_file_size BIGINT
)
RETURNS TABLE (
  token_id UUID,
  user_id UUID,
  session_id UUID,
  room_id UUID,
  upload_key VARCHAR,
  error_code VARCHAR
) AS $$
DECLARE
  v_token media.upload_tokens%ROWTYPE;
BEGIN
  SELECT *
  INTO v_token
  FROM media.upload_tokens t
  WHERE t.token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::VARCHAR,
      'TOKEN_NOT_FOUND'::VARCHAR;
    RETURN;
  END IF;

  IF v_token.status != 'pending' THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::VARCHAR,
      'TOKEN_ALREADY_USED'::VARCHAR;
    RETURN;
  END IF;

  IF v_token.expires_at < NOW() THEN
    UPDATE media.upload_tokens
    SET status = 'expired'
    WHERE id = v_token.id;

    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::VARCHAR,
      'TOKEN_EXPIRED'::VARCHAR;
    RETURN;
  END IF;

  IF NOT (p_mime_type = ANY(v_token.allowed_mime_types)) THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::VARCHAR,
      'INVALID_MIME_TYPE'::VARCHAR;
    RETURN;
  END IF;

  IF p_file_size > v_token.max_file_size_bytes THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::UUID,
      NULL::VARCHAR,
      'FILE_TOO_LARGE'::VARCHAR;
    RETURN;
  END IF;

  UPDATE media.upload_tokens
  SET
    status = 'uploading',
    client_mime_type = p_mime_type,
    client_file_size = p_file_size
  WHERE id = v_token.id;

  RETURN QUERY SELECT
    v_token.id,
    v_token.anonymous_user_id,
    v_token.session_id,
    v_token.target_room_id,
    v_token.upload_key,
    NULL::VARCHAR;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION media.consume_upload_token IS 'Atomically validates an upload token and marks it uploading.';

CREATE TRIGGER trg_media_assets_updated_at
  BEFORE UPDATE ON media.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

COMMIT;

