import type { Config } from '../config';
import { createRng, logNormal, type Rng } from '../lib/random';
import { smootherstep, smoothstep } from '../lib/math';
import { isCjkKind, segmentText, splitGraphemes } from './segment';

/** Seconds at 1× speed. */
export const LEAD_IN = 0.3;
export const BLINK_PERIOD = 1.06;
/** Cursor stays solid this long after the last keystroke before blinking resumes. */
export const IDLE_BEFORE_BLINK = 0.5;
export const PULLBACK_EXTRA = 1.0;

export interface Commit {
  /** time (s) at which these graphemes appear */
  t: number;
  /** number of graphemes visible after this commit */
  len: number;
  /** grapheme range the camera focuses on (the word being typed / just committed) */
  focusStart: number;
  focusEnd: number;
  /** 0..1 — how much the focus should follow the caret instead of the word (accel mode at high speed) */
  caretFollow: number;
}

export type KeyKind = 'key' | 'space';

export interface Keystroke {
  t: number;
  kind: KeyKind;
}

export interface Timeline {
  graphemes: string[];
  commits: Commit[];
  /** key sounds: a natural-speed typing track over the typing phase, not synced to individual characters */
  keystrokes: Keystroke[];
  speed: number;
  leadIn: number;
  blinkPeriod: number;
  typingStart: number;
  typingEnd: number;
  duration: number;
}

/** Speed multiplier for accelerate mode at text progress p ∈ [0,1]. Interpolated in log space. */
export function accelFactor(p: number, accel: Config['speed']['accel']): number {
  const e =
    accel.curve === 's'
      ? smootherstep(p / Math.max(accel.portion, 1e-3))
      : 1 - Math.cos((Math.min(Math.max(p, 0), 1) * Math.PI) / 2);
  return Math.pow(accel.peak, e);
}

/** Break long Chinese words into 2–3 character groups, like IME phrase commits. */
function splitCjkGroups(n: number, rng: Rng): number[] {
  const groups: number[] = [];
  let rest = n;
  while (rest > 4) {
    const g = rng() < 0.5 ? 2 : 3;
    groups.push(g);
    rest -= g;
  }
  if (rest > 0) groups.push(rest);
  return groups;
}

/** Natural typing sound: ~70 WPM, letters in bursts, a space bar and a short pause between words. */
const KEY_INTERVAL = 0.13;
const WORD_PAUSE = 0.24;
/** Short texts still get a believable burst of typing sound (it may run past the last character). */
export const MIN_TYPING_SOUND = 1.2;
/** Let the last key sound ring out before the video ends. */
const SOUND_RELEASE = 0.2;

interface Unit {
  end: number;
  delay: number;
  focusStart: number;
  focusEnd: number;
  caretFollow: number;
}

export function buildTimeline(cfg: Config): Timeline {
  const sp = cfg.speed.global;
  const { enMode, cnMode, wpm, cpm, wordGap, accel } = cfg.speed;
  const rng = createRng(cfg.seed);
  const segments = segmentText(cfg.text);
  const graphemes = splitGraphemes(cfg.text);
  const total = graphemes.length;
  const baseEn = 60 / (wpm * 5);
  const baseCn = 60 / cpm;

  const units: Unit[] = [];
  // Last non-space word range, so a trailing space keeps the camera on the previous word.
  let lastWord = { start: 0, end: 0 };

  for (const seg of segments) {
    const cn = isCjkKind(seg.kind);
    const mode = cn ? cnMode : enMode;
    const base = cn ? baseCn : baseEn;
    const n = seg.graphemes.length;
    const isSpace = seg.kind === 'space';

    const push = (end: number, delay: number, caretFollow: number, wordStart: number) => {
      if (!isSpace) lastWord = { start: wordStart, end };
      units.push({ end, delay, focusStart: lastWord.start, focusEnd: lastWord.end, caretFollow });
    };

    if (mode === 'B') {
      for (let i = 0; i < n; i++) {
        const idx = seg.start + i;
        const s = accelFactor(idx / Math.max(total - 1, 1), accel);
        const jitter = accel.jitter ? logNormal(rng, 0.1, 0.8, 1.25) : 1;
        const caretFollow = smoothstep(0.35, 0.65, (s - 1) / Math.max(accel.peak - 1, 1e-3));
        push(idx + 1, (base / s) * jitter, caretFollow, seg.start);
      }
      continue;
    }

    switch (seg.kind) {
      case 'cjk': {
        let start = seg.start;
        for (const g of splitCjkGroups(n, rng)) {
          push(start + g, g * baseCn * logNormal(rng, 0.25), 0, start);
          start += g;
        }
        break;
      }
      case 'cjkPunct':
        for (let i = 0; i < n; i++) push(seg.start + i + 1, 0.5 * baseCn * logNormal(rng, 0.25), 0, seg.start + i);
        break;
      case 'space':
        for (let i = 0; i < n; i++) push(seg.start + i + 1, baseEn * wordGap * logNormal(rng, 0.25), 0, seg.start + i);
        break;
      default:
        for (let i = 0; i < n; i++) push(seg.start + i + 1, baseEn * logNormal(rng, 0.35), 0, seg.start);
    }
  }

  const leadIn = LEAD_IN / sp;
  const blinkPeriod = BLINK_PERIOD / sp;
  const typingStart = leadIn + cfg.cursor.blinkCount * blinkPeriod;
  let t = typingStart;
  const commits: Commit[] = units.map((u) => {
    t += u.delay / sp;
    return { t, len: u.end, focusStart: u.focusStart, focusEnd: u.focusEnd, caretFollow: u.caretFollow };
  });
  const typingEnd = t;
  const soundEnd = Math.max(typingEnd, typingStart + MIN_TYPING_SOUND);
  const keystrokes = commits.length ? buildKeystrokes(typingStart, soundEnd, createRng(cfg.seed ^ 0x9e3779b9)) : [];
  const tail = (cfg.speed.tailHold + (cfg.speed.pullback ? PULLBACK_EXTRA : 0)) / sp;
  const lastSound = cfg.audio.enabled && keystrokes.length ? keystrokes[keystrokes.length - 1].t + SOUND_RELEASE : 0;
  const duration = Math.max(typingEnd + tail, lastSound, 0.5);

  return { graphemes, commits, keystrokes, speed: sp, leadIn, blinkPeriod, typingStart, typingEnd, duration };
}

/**
 * Typing sound at a steady human pace from typing start to the last character (at least MIN_TYPING_SOUND). It is independent of
 * the on-screen rhythm (and of the animation speed) so it always sounds like normal typing.
 */
function buildKeystrokes(from: number, to: number, rng: Rng): Keystroke[] {
  const out: Keystroke[] = [];
  let t = from + 0.05;
  while (t <= to) {
    const letters = 2 + Math.floor(rng() * 6);
    for (let i = 0; i < letters && t <= to; i++) {
      out.push({ t, kind: 'key' });
      t += KEY_INTERVAL * logNormal(rng, 0.3);
    }
    if (t > to) break;
    out.push({ t, kind: 'space' });
    t += WORD_PAUSE * logNormal(rng, 0.3);
  }
  return out;
}

/** Index of the last commit at or before t (−1 if none). */
export function commitIndexAt(tl: Timeline, t: number): number {
  const c = tl.commits;
  let lo = 0;
  let hi = c.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (c[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
