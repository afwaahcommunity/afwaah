export const redisKeys = {
  session: (tokenHash: string) => `session:${tokenHash}`,
  userBan: (userId: string) => `ban:user:${userId}`,
  sessionBan: (sessionId: string) => `ban:session:${sessionId}`,
  rateLimit: (action: string, subjectId: string) =>
    `ratelimit:${action}:${subjectId}`,
  rateLimitBurst: (action: string, subjectId: string) =>
    `ratelimit:${action}:${subjectId}:burst`,
  roomPresence: (roomId: string) => `presence:room:${roomId}`,
  roomPresenceCount: (roomId: string) => `presence:room:${roomId}:count`,
  typing: (roomId: string) => `typing:${roomId}`,
  recentRoomMessages: (roomId: string) => `messages:room:${roomId}:recent`,
  roomMetadata: (roomId: string) => `room:${roomId}`,
  ipCooldown: (ipHash: string) => `cooldown:ip:${ipHash}`,
  subnetCooldown: (subnetHash: string) => `cooldown:subnet:${subnetHash}`,
  asnCooldown: (asnHash: string) => `cooldown:asn:${asnHash}`,
} as const;

export const redisTtlSeconds = {
  session: 60 * 60 * 24,
  typing: 10,
  roomMetadata: 60 * 5,
  presenceHeartbeat: 30,
  recentMessagesCap: 100,
} as const;
