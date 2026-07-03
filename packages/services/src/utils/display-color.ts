export const DISPLAY_COLOR_PALETTE = [
  "#64748B",
  "#DC2626",
  "#EA580C",
  "#D97706",
  "#16A34A",
  "#059669",
  "#0891B2",
  "#2563EB",
  "#7C3AED",
  "#C026D3",
  "#DB2777",
  "#475569",
] as const;

export type DisplayColor = (typeof DISPLAY_COLOR_PALETTE)[number];

export interface DisplayColorValidation {
  reason?: string;
  valid: boolean;
}

export function generateDisplayColor(): DisplayColor {
  return DISPLAY_COLOR_PALETTE[randomIndex(DISPLAY_COLOR_PALETTE.length)]!;
}

export function normalizeDisplayColor(color: string): string {
  return color.trim().toUpperCase();
}

export function validateDisplayColor(color: string): DisplayColorValidation {
  const normalized = normalizeDisplayColor(color);

  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    return {
      reason: "Display color must be a hex color in #RRGGBB format.",
      valid: false,
    };
  }

  return { valid: true };
}

function randomIndex(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}
