export const DISPLAY_COLORS = [
  "#f87171", // red
  "#fb923c", // orange
  "#fbbf24", // amber
  "#a3e635", // lime
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#818cf8", // indigo
  "#c084fc", // violet
  "#f472b6", // pink
  "#94a3b8", // slate
  "#d4d4d8", // zinc
] as const;

export const NAME_PARTS_A = [
  "quiet", "brave", "silent", "wandering", "curious", "hidden", "swift",
  "bright", "soft", "wild", "gentle", "sharp", "amber", "cobalt", "lunar",
];
export const NAME_PARTS_B = [
  "otter", "sparrow", "fox", "moth", "koi", "heron", "willow", "cinder",
  "atlas", "river", "quartz", "ember", "harbor", "meadow", "pilot",
];

export function randomDisplayName(): string {
  const a = NAME_PARTS_A[Math.floor(Math.random() * NAME_PARTS_A.length)];
  const b = NAME_PARTS_B[Math.floor(Math.random() * NAME_PARTS_B.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return `${a ?? "quiet"}-${b ?? "harbor"}-${n}`;
}

export function randomDisplayColor(): string {
  return DISPLAY_COLORS[Math.floor(Math.random() * DISPLAY_COLORS.length)] ?? "#818cf8";
}
