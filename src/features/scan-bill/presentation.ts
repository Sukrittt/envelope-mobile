export const DIVISORS = [1, 2, 3, 4];
export const PEOPLE_COUNTS = [2, 3, 4, 5];

// Reveal cascade for each phase's first paint — same shared-value-driven
// pattern and constants as money-brain.tsx/Heatmap.tsx, reused as-is.
export const MOUNT_START_DELAY_MS = 100;
export const BLOCK_STAGGER_MS = 90;
export const ITEM_STAGGER_MS = 45;
export const ITEM_STAGGER_CAP_INDEX = 6;

export function splitLabel(divisor: number | null): string {
  if (divisor === null) return "skip";
  if (divisor === 1) return "Mine";
  return `÷${divisor}`;
}

