export type Orientation = 'portrait' | 'landscape' | 'square';

const SQUARE_TOLERANCE = 0.05;

export function classifyOrientation(width: number, height: number): Orientation {
  const ratio = width / height;
  if (Math.abs(ratio - 1) <= SQUARE_TOLERANCE) return 'square';
  return ratio > 1 ? 'landscape' : 'portrait';
}
