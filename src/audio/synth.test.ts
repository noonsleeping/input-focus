import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, mergeConfig, type Config } from '../config';
import { buildTimeline, MIN_TYPING_SOUND } from '../timeline/rhythm';
import { renderKeyTrack, SAMPLE_RATE } from './synth';

const cfg = (patch: unknown): Config => mergeConfig(DEFAULT_CONFIG, patch);

describe('keystrokes', () => {
  const meanGap = (ts: number[]) => (ts.at(-1)! - ts[0]) / (ts.length - 1);

  it('covers the typing phase, from typing start to the last character', () => {
    const tl = buildTimeline(DEFAULT_CONFIG);
    expect(tl.keystrokes[0].t).toBeGreaterThanOrEqual(tl.typingStart);
    expect(tl.keystrokes.at(-1)!.t).toBeLessThanOrEqual(tl.typingEnd);
    expect(tl.typingEnd - tl.keystrokes.at(-1)!.t).toBeLessThan(0.5);
  });

  it('plays at a normal typing pace regardless of the on-screen rhythm or animation speed', () => {
    const text = '帮我写一个 Python 脚本，把文件夹里的图片批量压缩，然后保存到新的目录里面';
    for (const speed of [{ global: 0.5, cnMode: 'A' }, { global: 1.8, enMode: 'B', cnMode: 'B' }, { global: 3 }]) {
      const tl = buildTimeline(cfg({ text, speed }));
      const gap = meanGap(tl.keystrokes.map((k) => k.t));
      expect(gap).toBeGreaterThan(0.12);
      expect(gap).toBeLessThan(0.22);
    }
  });

  it('mixes letter keys with a space bar between words', () => {
    const tl = buildTimeline(cfg({ speed: { global: 0.5 } }));
    const kinds = new Set(tl.keystrokes.map((k) => k.kind));
    expect(kinds).toEqual(new Set(['key', 'space']));
  });

  it('short texts still get at least ~1.2 s of typing sound, and the video is long enough to hold it', () => {
    const tl = buildTimeline(cfg({ text: 'hi', speed: { global: 3, tailHold: 0 } }));
    expect(tl.typingEnd - tl.typingStart).toBeLessThan(0.3);
    const last = tl.keystrokes.at(-1)!.t;
    expect(last - tl.typingStart).toBeGreaterThan(MIN_TYPING_SOUND - 0.35);
    expect(last).toBeLessThanOrEqual(tl.typingStart + MIN_TYPING_SOUND);
    expect(tl.duration).toBeGreaterThan(last);
  });

  it('sound does not change the typing rhythm', () => {
    const a = buildTimeline(cfg({ audio: { enabled: true } }));
    const b = buildTimeline(cfg({ audio: { enabled: false } }));
    expect(a.commits).toEqual(b.commits);
  });
});

describe('renderKeyTrack', () => {
  const tl = buildTimeline(DEFAULT_CONFIG);

  it.each(['mechanical', 'membrane', 'laptop'] as const)('%s: covers the clip, audible, never clips', (profile) => {
    const track = renderKeyTrack(tl.keystrokes, tl.duration, { enabled: true, profile, volume: 1 }, 1);
    expect(track.length).toBeGreaterThanOrEqual(Math.floor(tl.duration * SAMPLE_RATE));
    let peak = 0;
    for (const v of track) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it('is silent before the first keystroke and deterministic per seed', () => {
    const a = renderKeyTrack(tl.keystrokes, tl.duration, DEFAULT_CONFIG.audio, 7);
    const b = renderKeyTrack(tl.keystrokes, tl.duration, DEFAULT_CONFIG.audio, 7);
    expect(a).toEqual(b);
    const first = Math.floor(tl.keystrokes[0].t * SAMPLE_RATE);
    expect(a.subarray(0, first).every((v) => v === 0)).toBe(true);
  });
});
