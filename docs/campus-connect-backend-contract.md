# Afwaah Backend Contract Status

This note tracks backend contract support for the Next.js Afwaah chat/admin module while preserving the current UI and behavior.

## Wired

- Anonymous session create/validate/profile color/profile name.
- Location verification with browser coordinates.
- Room list now includes public rooms, joined private rooms, and rooms created by the current user.
- Room creation limits are exposed through `room.creationLimits`.
- Room detail, room create, share info, invite join, room leave.
- Message history includes `reactionCounts` and viewer-specific `myReactions`.
- Own-message delete and reaction add/remove.
- Report creation for message/user/room targets, including reported user metadata for message reports.
- Admin login, report resolve/dismiss by id, user ban by id.
- Admin overview, report list, user list/detail, room list/detail, admin room messages, and room removal.
- Active ban info includes `targetRoomId`.
- Realtime room join/leave, message send, typing start/stop, message receive.
- Realtime message payloads include `userId`; typing payloads include `userId`; presence payloads include user previews.

## Remaining Backend Improvements

These are not required for the current frontend to function, but they are good next hardening steps.

1. Add admin audit log writes for admin report resolution, bans, room removal, room locks, and future admin invite actions.

2. Expand admin room moderation mutations.
   - Lock/archive room.
   - Admin regenerate/disable private room invites.
   - Room participant actions from the admin panel.

3. Add richer admin report context from database joins.
   - Current implementation preserves frontend-provided report evidence context.
   - Later, enrich reports server-side with joined message/room/user snapshots.

4. Replace empty recent admin activity with real audit-log-backed activity after audit writes are added.

## Current Frontend Fallbacks

- If `NEXT_PUBLIC_USE_MOCKS=true`, the frontend uses Lovable-style mock data.
- If mock mode is off but the backend is offline, the adapter falls back only for offline/missing transport cases.
- Admin pages now call real admin tRPC endpoints and fall back to mocks only through the adapter fallback path.
