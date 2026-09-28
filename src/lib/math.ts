export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 6x⁵ − 15x⁴ + 10x³ — first and second derivatives are 0 at both ends. */
export function smootherstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * t * (t * (6 * t - 15) + 10);
}
