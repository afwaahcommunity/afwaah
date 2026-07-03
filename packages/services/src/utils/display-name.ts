const ADJECTIVES = [
  "Amber",
  "Bright",
  "Calm",
  "Crimson",
  "Hidden",
  "Lucky",
  "Quiet",
  "Rapid",
  "Silent",
  "Silver",
  "Soft",
  "Urban",
] as const;

const NOUNS = [
  "Comet",
  "Echo",
  "Falcon",
  "Flame",
  "Leaf",
  "Nova",
  "Signal",
  "Spark",
  "Stone",
  "Wave",
  "Wing",
  "Zenith",
] as const;

export interface DisplayNameValidation {
  reason?: string;
  valid: boolean;
}

export function generateDisplayName(): string {
  const adjective = ADJECTIVES[randomIndex(ADJECTIVES.length)];
  const noun = NOUNS[randomIndex(NOUNS.length)];
  const suffix = randomIndex(90) + 10;
  return `${adjective} ${noun} ${suffix}`;
}

export function sanitizeDisplayName(displayName: string): string {
  return displayName.replace(/\s+/g, " ").trim();
}

export function validateDisplayName(
  displayName: string,
): DisplayNameValidation {
  const normalized = sanitizeDisplayName(displayName);

  if (normalized.length < 2) {
    return { reason: "Display name is too short.", valid: false };
  }

  if (normalized.length > 50) {
    return { reason: "Display name is too long.", valid: false };
  }

  if (!/^[a-zA-Z0-9 _.-]+$/.test(normalized)) {
    return {
      reason:
        "Display name can only contain letters, numbers, spaces, dots, dashes, and underscores.",
      valid: false,
    };
  }

  return { valid: true };
}

function randomIndex(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}
