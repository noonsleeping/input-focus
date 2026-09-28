import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, mergeConfig, type Config } from '../config';
import { accelFactor, buildTimeline, commitIndexAt } from './rhythm';
import { segmentText } from './segment';

const cfg = (patch: unknown): Config => mergeConfig(DEFAULT_CONFIG, patch);

describe('segmentText', () => {
  it('splits mixed Chinese / English into word-level segments', () => {
    const kinds = segmentText('帮我写一个 Python 脚本，好').map((s) => s.kind);
    expect(kinds).toContain('cjk');
    expect(kinds).toContain('en');
    expect(kinds).toContain('space');
    expect(kinds).toContain('cjkPunct');
  });
});

describe('buildTimeline', () => {
  it('is deterministic for the same seed and differs across seeds', () => {
    const a = buildTimeline(cfg({ seed: 1 }));
    const b = buildTimeline(cfg({ seed: 1 }));
    const c = buildTimeline(cfg({ seed: 2 }));
    expect(a.commits).toEqual(b.commits);
    expect(a.commits.map((x) => x.t)).not.toEqual(c.commits.map((x) => x.t));
  });

  it('ends with the full text visible, and commit times strictly increase', () => {
    const tl = buildTimeline(DEFAULT_CONFIG);
    expect(tl.commits.at(-1)!.len).toBe(tl.graphemes.length);
    for (let i = 1; i < tl.commits.length; i++) expect(tl.commits[i].t).toBeGreaterThan(tl.commits[i - 1].t);
  });

  it('Chinese mode A commits whole words; mode B commits one character at a time', () => {
    const text = '今天天气真不错';
    const a = buildTimeline(cfg({ text, speed: { cnMode: 'A' } }));
    const b = buildTimeline(cfg({ text, speed: { cnMode: 'B' } }));
    expect(a.commits.length).toBeLessThan(text.length);
    expect(b.commits.length).toBe(text.length);
  });

  it('English mode A types letter by letter', () => {
    const tl = buildTimeline(cfg({ text: 'hello world', speed: { enMode: 'A' } }));
    expect(tl.commits.length).toBe(11);
  });

  it('starts typing after lead-in + blinks, scaled by global speed', () => {
    const t1 = buildTimeline(cfg({ cursor: { blinkCount: 2 }, speed: { global: 1 } }));
    const t2 = buildTimeline(cfg({ cursor: { blinkCount: 2 }, speed: { global: 2 } }));
    expect(t1.typingStart).toBeCloseTo(0.3 + 2 * 1.06);
    expect(t2.typingStart).toBeCloseTo(t1.typingStart / 2);
    expect(t2.duration).toBeCloseTo(t1.duration / 2);
  });

  it('commitIndexAt finds the last commit at or before t', () => {
    const tl = buildTimeline(DEFAULT_CONFIG);
    expect(commitIndexAt(tl, 0)).toBe(-1);
    expect(commitIndexAt(tl, tl.commits[3].t)).toBe(3);
    expect(commitIndexAt(tl, tl.duration)).toBe(tl.commits.length - 1);
  });
});

describe('accelerate mode', () => {
  const accel = { peak: 6, portion: 0.7, curve: 's' as const, jitter: false };

  it('S curve goes from 1× to peak and holds after the acceleration portion', () => {
    expect(accelFactor(0, accel)).toBeCloseTo(1);
    expect(accelFactor(0.7, accel)).toBeCloseTo(6);
    expect(accelFactor(0.9, accel)).toBeCloseTo(6);
  });

  it('S curve starts and ends with ~zero acceleration (no jerky start/stop)', () => {
    const h = 1e-3;
    const slope = (p: number) => (accelFactor(p + h, accel) - accelFactor(p, accel)) / h;
    const mid = slope(0.35);
    expect(slope(0) / mid).toBeLessThan(0.01);
    expect(slope(0.7 - h) / mid).toBeLessThan(0.01);
  });

  it('intervals shrink monotonically across the text in mode B', () => {
    const tl = buildTimeline(cfg({ text: 'abcdefghijklmnopqrstuvwxyz', speed: { enMode: 'B', accel } }));
    const gaps = tl.commits.slice(1).map((c, i) => c.t - tl.commits[i].t);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1] + 1e-9);
    expect(gaps[0] / gaps.at(-1)!).toBeGreaterThan(5);
  });
});
