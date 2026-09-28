export type Rng = () => number;

/** mulberry32: small, fast, deterministic PRNG returning [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Log-normal multiplier with mean ≈ 1, clamped so a single outlier can't stall or blur the rhythm. */
export function logNormal(rng: Rng, sigma: number, min = 0.45, max = 2.2): number {
  const m = Math.exp(sigma * gaussian(rng) - (sigma * sigma) / 2);
  return Math.min(max, Math.max(min, m));
}
