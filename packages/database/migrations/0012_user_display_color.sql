BEGIN;

ALTER TABLE core.anonymous_users
  ADD COLUMN current_display_color VARCHAR(7) NOT NULL DEFAULT '#64748B';

ALTER TABLE core.anonymous_users
  ADD CONSTRAINT anonymous_users_display_color_check
  CHECK (current_display_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE core.messages
  ADD COLUMN display_color_snapshot VARCHAR(7) NOT NULL DEFAULT '#64748B';

ALTER TABLE core.messages
  ADD CONSTRAINT messages_display_color_snapshot_check
  CHECK (display_color_snapshot ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE core.rate_limit_config
  DROP CONSTRAINT IF EXISTS rate_limit_config_action_type_check;

ALTER TABLE core.rate_limit_config
  ADD CONSTRAINT rate_limit_config_action_type_check
  CHECK (action_type IN (
    'message_send',
    'message_burst',
    'room_create',
    'display_name_change',
    'display_color_change',
    'image_upload',
    'report_create',
    'reaction_add',
    'room_join'
  ));

COMMIT;
