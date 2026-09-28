import type { Config, SoundProfile } from '../config';
import { createRng, type Rng } from '../lib/random';
import type { KeyKind, Keystroke } from '../timeline/rhythm';

export const SAMPLE_RATE = 48000;
const VARIANTS = 8;

// ---------- tiny DSP toolkit ----------

type FilterType = 'lowpass' | 'highpass' | 'bandpass';

/** RBJ biquad, applied in place. */
function biquad(x: Float32Array, type: FilterType, freq: number, q: number): Float32Array {
  const w = (2 * Math.PI * freq) / SAMPLE_RATE;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i];
    y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

const ms = (v: number) => Math.round((v / 1000) * SAMPLE_RATE);

/** White noise with an exponential decay envelope, starting at `at` ms. */
function noiseBurst(len: number, rng: Rng, decayMs: number, at = 0): Float32Array {
  const out = new Float32Array(len);
  const start = ms(at);
  const k = 1 / ms(decayMs);
  for (let i = start; i < len; i++) out[i] = (rng() * 2 - 1) * Math.exp(-(i - start) * k);
  return out;
}

/** Damped sine — the resonant "body" of a key. */
function tone(len: number, freq: number, decayMs: number, at = 0): Float32Array {
  const out = new Float32Array(len);
  const start = ms(at);
  const k = 1 / ms(decayMs);
  const w = (2 * Math.PI * freq) / SAMPLE_RATE;
  for (let i = start; i < len; i++) out[i] = Math.sin(w * (i - start)) * Math.exp(-(i - start) * k);
  return out;
}

function mixInto(dst: Float32Array, src: Float32Array, gain: number) {
  for (let i = 0; i < dst.length; i++) dst[i] += src[i] * gain;
}

function normalize(x: Float32Array, peak = 1): Float32Array {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

// ---------- key voices ----------

/** One recorded-sounding key press. `v` jitters pitch/decay so variants don't sound cloned. */
function makeVoice(profile: SoundProfile, kind: KeyKind, rng: Rng): Float32Array {
  const v = () => 0.9 + rng() * 0.2;
  const len = ms(150);
  const out = new Float32Array(len);
  const space = kind === 'space';

  switch (profile) {
    case 'mechanical': {
      // sharp switch click + thocky bottom-out + softer release click
      mixInto(out, biquad(noiseBurst(len, rng, 2.5 * v()), 'bandpass', (space ? 2600 : 4200) * v(), 1.2), 0.9);
      mixInto(out, biquad(noiseBurst(len, rng, (space ? 22 : 12) * v()), 'bandpass', (space ? 700 : 950) * v(), 2), 0.5);
      mixInto(out, tone(len, (space ? 150 : 260) * v(), (space ? 30 : 16) * v()), space ? 0.55 : 0.35);
      if (space) mixInto(out, biquad(noiseBurst(len, rng, 20, 4), 'bandpass', 1800 * v(), 3), 0.25); // stabilizer rattle
      mixInto(out, biquad(noiseBurst(len, rng, 2, 70 + rng() * 20), 'bandpass', 3000 * v(), 1.5), 0.3);
      break;
    }
    case 'membrane': {
      // muffled rubber-dome press, no crisp click
      mixInto(out, biquad(noiseBurst(len, rng, (space ? 16 : 9) * v()), 'lowpass', (space ? 900 : 1400) * v(), 0.8), 1);
      mixInto(out, tone(len, (space ? 120 : 180) * v(), (space ? 30 : 20) * v()), 0.35);
      break;
    }
    case 'laptop': {
      // light, short scissor-switch tick
      mixInto(out, biquad(noiseBurst(len, rng, 3.5 * v()), 'bandpass', (space ? 1600 : 2600) * v(), 1.5), 0.8);
      mixInto(out, tone(len, 700 * v(), 6 * v()), 0.15);
      mixInto(out, tone(len, (space ? 160 : 220) * v(), (space ? 18 : 10) * v()), 0.2);
      mixInto(out, biquad(noiseBurst(len, rng, 2, 45 + rng() * 15), 'bandpass', 2400 * v(), 1.5), 0.12);
      break;
    }
  }
  biquad(out, 'highpass', 60, 0.7); // remove rumble/DC
  return normalize(out, space ? 1 : 0.8);
}

const voiceCache = new Map<string, Record<KeyKind, Float32Array[]>>();

function getVoices(profile: SoundProfile): Record<KeyKind, Float32Array[]> {
  let v = voiceCache.get(profile);
  if (!v) {
    const rng = createRng(0x5eed + profile.length);
    v = {
      key: Array.from({ length: VARIANTS }, () => makeVoice(profile, 'key', rng)),
      space: Array.from({ length: VARIANTS }, () => makeVoice(profile, 'space', rng)),
    };
    voiceCache.set(profile, v);
  }
  return v;
}

// ---------- track ----------

/** Mono PCM track (SAMPLE_RATE) with one voice per keystroke, deterministic for a given seed. */
export function renderKeyTrack(keys: Keystroke[], duration: number, audio: Config['audio'], seed: number): Float32Array {
  const track = new Float32Array(Math.ceil(duration * SAMPLE_RATE) + 1);
  const voices = getVoices(audio.profile);
  const rng = createRng(seed ^ 0x51a7e);
  const master = audio.volume * 0.6;

  for (const k of keys) {
    const voice = voices[k.kind][Math.floor(rng() * VARIANTS)];
    const gain = master * (0.75 + rng() * 0.25);
    const rate = 0.96 + rng() * 0.08; // small pitch variation via resampling
    const start = Math.round(k.t * SAMPLE_RATE);
    const n = Math.floor((voice.length - 1) / rate);
    for (let i = 0; i < n && start + i < track.length; i++) {
      const p = i * rate;
      const j = Math.floor(p);
      track[start + i] += (voice[j] + (voice[j + 1] - voice[j]) * (p - j)) * gain;
    }
  }

  // Soft-clip overlapping presses instead of hard clipping.
  for (let i = 0; i < track.length; i++) if (Math.abs(track[i]) > 0.8) track[i] = Math.tanh(track[i]);
  return track;
}
