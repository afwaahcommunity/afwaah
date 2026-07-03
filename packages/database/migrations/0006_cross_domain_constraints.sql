BEGIN;

ALTER TABLE core.display_name_history
  ADD CONSTRAINT fk_display_name_changed_by_admin
  FOREIGN KEY (changed_by_admin_id)
  REFERENCES admin.admin_users(id);

ALTER TABLE core.rooms
  ADD CONSTRAINT fk_rooms_locked_by_admin
  FOREIGN KEY (locked_by_admin_id)
  REFERENCES admin.admin_users(id);

ALTER TABLE core.room_participants
  ADD CONSTRAINT fk_room_participants_banned_by_admin
  FOREIGN KEY (banned_by_admin_id)
  REFERENCES admin.admin_users(id);

ALTER TABLE core.messages
  ADD CONSTRAINT fk_messages_deleted_by_admin
  FOREIGN KEY (deleted_by_admin_id)
  REFERENCES admin.admin_users(id);

ALTER TABLE moderation.reports
  ADD CONSTRAINT fk_reports_resolved_by_admin
  FOREIGN KEY (resolved_by_admin_id)
  REFERENCES admin.admin_users(id);

ALTER TABLE moderation.bans
  ADD CONSTRAINT fk_bans_created_by_admin
  FOREIGN KEY (created_by_admin_id)
  REFERENCES admin.admin_users(id),
  ADD CONSTRAINT fk_bans_revoked_by_admin
  FOREIGN KEY (revoked_by_admin_id)
  REFERENCES admin.admin_users(id);

ALTER TABLE moderation.network_cooldowns
  ADD CONSTRAINT fk_cooldowns_created_by_admin
  FOREIGN KEY (created_by_admin_id)
  REFERENCES admin.admin_users(id),
  ADD CONSTRAINT fk_cooldowns_cancelled_by_admin
  FOREIGN KEY (cancelled_by_admin_id)
  REFERENCES admin.admin_users(id);

ALTER TABLE media.media_assets
  ADD CONSTRAINT fk_media_moderated_by_admin
  FOREIGN KEY (moderated_by_admin_id)
  REFERENCES admin.admin_users(id),
  ADD CONSTRAINT fk_media_deleted_by_admin
  FOREIGN KEY (deleted_by_admin_id)
  REFERENCES admin.admin_users(id);

COMMIT;

