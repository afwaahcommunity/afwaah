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
      b.ban_type IN ('global_hard_ban', 'global_write_ban', 'quarantine')
      OR (
        p_room_id IS NOT NULL
        AND b.ban_type = 'room_ban'
        AND b.target_room_id = p_room_id
      )
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
