# Redis Data Structures

Redis is for fast, ephemeral operational state. PostgreSQL remains the durable source of truth.

## Sessions

```txt
session:{token_hash}
type: hash
ttl: 24 hours, sliding
fields: session_id, user_id, display_name, trust_level, risk_score, status,
        location_verified, location_valid_until, created_at, last_seen_at
```

## Active Bans

```txt
ban:user:{user_id}
ban:session:{session_id}
type: hash
fields: ban_id, ban_type, confidence, expires_at, reason
```

## Rate Limits

```txt
ratelimit:{action}:{subject_id}
ratelimit:{action}:{subject_id}:burst
type: string counter
ttl: configured action window
```

## Presence

```txt
presence:room:{room_id}
type: sorted set
score: last heartbeat timestamp
member: session_id

presence:room:{room_id}:count
type: string counter
```

## Typing

```txt
typing:{room_id}
type: hash
ttl: 10 seconds
fields: {session_id}: {display_name}:{timestamp}
```

## Recent Messages

```txt
messages:room:{room_id}:recent
type: list
cap: 100 messages
value: serialized message payload
```

## Room Metadata

```txt
room:{room_id}
type: hash
ttl: 5 minutes
fields: id, name, slug, room_type, status, participant_count,
        slow_mode_seconds, allow_images, allow_links
```

## Network Cooldowns

```txt
cooldown:ip:{ip_hash}
cooldown:subnet:{subnet_hash}
cooldown:asn:{asn_hash}
type: hash
ttl: cooldown duration
fields: restriction_type, expires_at, reason
```
