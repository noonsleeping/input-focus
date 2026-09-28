export type RhythmMode = 'A' | 'B';
export type CursorShape = 'thin' | 'thick' | 'underline' | 'block' | 'hollow';
export type BlinkStyle = 'hard' | 'smooth';
export type AccelCurve = 's' | 'easeIn';
export type CameraSensitivity = 'slow' | 'mid' | 'fast';
export type Quality = 'standard' | 'high' | 'max';
export type TemplateId = 'search-pill' | 'search-button' | 'ai-light' | 'ai-dark' | 'claude-code' | 'codex';
export type CharAnim = 'none' | 'fade' | 'rise';

export interface LensEffect {
  enabled: boolean;
  amount: number;
}
export type ScreenMode = 'none' | 'phone' | 'crt' | 'lcd';
export type SoundProfile = 'mechanical' | 'membrane' | 'laptop';

export interface Config {
  text: string;
  placeholder: string;
  seed: number;
  /** how newly typed characters appear */
  charAnim: {
    mode: CharAnim;
    /** seconds at 1× speed */
    duration: number;
  };
  cursor: {
    blinkCount: number;
    shape: CursorShape;
    blinkStyle: BlinkStyle;
    /** null = follow template */
    color: string | null;
  };
  template: {
    id: TemplateId;
    logoText: string;
    fontScale: number;
    /** model name shown by the coding-agent templates */
    model: { 'claude-code': string; codex: string };
  };
  speed: {
    global: number;
    enMode: RhythmMode;
    cnMode: RhythmMode;
    wpm: number;
    cpm: number;
    wordGap: number;
    accel: {
      peak: number;
      portion: number;
      curve: AccelCurve;
      jitter: boolean;
    };
    cameraSensitivity: CameraSensitivity;
    /** start with a wide shot and push in; off = start close-up at the cursor */
    openingWide: boolean;
    /** where the focus point sits in close-up, as a fraction of frame width / height */
    compositionX: number;
    compositionY: number;
    closeUp: number;
    tailHold: number;
    pullback: boolean;
  };
  screen: {
    mode: ScreenMode;
    strength: number;
  };
  audio: {
    enabled: boolean;
    profile: SoundProfile;
    volume: number;
  };
  lens: {
    dof: LensEffect;
    vignette: LensEffect;
    chroma: LensEffect;
    grain: LensEffect;
  };
  output: {
    preset: string;
    width: number;
    height: number;
    fps: number;
    quality: Quality;
  };
}

export const RESOLUTION_PRESETS: { id: string; label: string; width: number; height: number }[] = [
  { id: '720p', label: '1280×720 (16:9)', width: 1280, height: 720 },
  { id: '1080p', label: '1920×1080 (16:9)', width: 1920, height: 1080 },
  { id: '1440p', label: '2560×1440 (16:9)', width: 2560, height: 1440 },
  { id: '4k', label: '3840×2160 (16:9)', width: 3840, height: 2160 },
  { id: 'vertical', label: '1080×1920 (竖屏)', width: 1080, height: 1920 },
  { id: 'square', label: '1080×1080 (方形)', width: 1080, height: 1080 },
  { id: 'custom', label: '自定义', width: 1920, height: 1080 },
];

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export const DEFAULT_CONFIG: Config = {
  text: '帮我写一个 Python 脚本，把文件夹里的图片批量压缩',
  placeholder: '',
  seed: 20260928,
  charAnim: {
    mode: 'none',
    duration: 0.15,
  },
  cursor: {
    blinkCount: 4,
    shape: 'thick',
    blinkStyle: 'smooth',
    color: null,
  },
  template: {
    id: 'search-pill',
    logoText: '',
    fontScale: 1,
    model: { 'claude-code': 'Opus 5.5', codex: 'GPT-6 Sol' },
  },
  speed: {
    global: 1.8,
    enMode: 'B',
    cnMode: 'B',
    wpm: 80,
    cpm: 145,
    wordGap: 2,
    accel: {
      peak: 5,
      portion: 0.7,
      curve: 's',
      jitter: true,
    },
    cameraSensitivity: 'mid',
    openingWide: true,
    compositionX: 0.45,
    compositionY: 0.5,
    closeUp: 2.8,
    tailHold: 1.5,
    pullback: false,
  },
  screen: {
    mode: 'none',
    strength: 0.25,
  },
  audio: {
    enabled: true,
    profile: 'mechanical',
    volume: 0.7,
  },
  lens: {
    dof: { enabled: false, amount: 0.5 },
    vignette: { enabled: false, amount: 0.5 },
    chroma: { enabled: false, amount: 0.4 },
    grain: { enabled: false, amount: 0.4 },
  },
  output: {
    preset: 'vertical',
    width: 1080,
    height: 1920,
    fps: 30,
    quality: 'high',
  },
};

/** Deep-merge a partial (e.g. from localStorage) onto defaults so new fields always exist. */
export function mergeConfig(base: Config, patch: unknown): Config {
  const merge = (a: any, b: any): any => {
    if (b === undefined || b === null || typeof a !== 'object' || a === null) return b ?? a;
    const out: any = Array.isArray(a) ? [...a] : { ...a };
    for (const k of Object.keys(a)) {
      if (!(k in b)) continue;
      const av = a[k];
      const bv = b[k];
      out[k] = av !== null && typeof av === 'object' && bv !== null && typeof bv === 'object' ? merge(av, bv) : bv;
    }
    return out;
  };
  return merge(base, patch);
}
