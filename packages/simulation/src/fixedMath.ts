// The simulation uses integer subpixels so browser and server calculations remain identical.
export const SUBPIXELS_PER_PIXEL = 256;

export function pixels(value: number): number {
  return Math.round(value * SUBPIXELS_PER_PIXEL);
}

export function toPixels(value: number): number {
  return value / SUBPIXELS_PER_PIXEL;
}

export function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}
