ALTER TABLE moderation.bans
  DROP CONSTRAINT IF EXISTS valid_ban_target;

ALTER TABLE moderation.bans
  ADD CONSTRAINT valid_ban_target
  CHECK (
    target_user_id IS NOT NULL
    OR target_session_id IS NOT NULL
  );

ALTER TABLE moderation.bans
  DROP CONSTRAINT IF EXISTS valid_room_ban;

ALTER TABLE moderation.bans
  ADD CONSTRAINT valid_room_ban
  CHECK (
    (
      ban_type = 'room_ban'
      AND target_room_id IS NOT NULL
      AND (
        target_user_id IS NOT NULL
        OR target_session_id IS NOT NULL
      )
    )
    OR (
      ban_type != 'room_ban'
      AND target_room_id IS NULL
    )
  );
