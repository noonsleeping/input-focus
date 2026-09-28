import type { Config } from '../config';
import { clamp, lerp } from '../lib/math';
import type { TemplateLayout } from '../scene/templates/types';
import type { TextLayout } from '../scene/textLayout';
import { commitIndexAt, IDLE_BEFORE_BLINK, LEAD_IN, type Timeline } from '../timeline/rhythm';

/**
 * Camera state. `cx, cy` is the page-space point at the frame center.
 * `zoomN` is output px per page px divided by the frame width, so the same track
 * works for any resolution with the same aspect ratio (preview vs export).
 */
export interface CameraState {
  cx: number;
  cy: number;
  zoomN: number;
  /** page-space point the lens is focused on (smoothed focus pull toward the latest word) */
  fx: number;
  fy: number;
}

export interface CameraTrack {
  sample(t: number): CameraState;
  /** zoomN of the close-up shot (used by screen effects to tune moiré to the typing shot) */
  closeZoomN: number;
}

const SIM_HZ = 240;
const PAN_OMEGA: Record<Config['speed']['cameraSensitivity'], number> = { slow: 3, mid: 5, fast: 8 };
const ZOOM_OMEGA = 2.6;
const FOCUS_OMEGA = 7;

interface Target {
  cx: number;
  cy: number;
  lz: number;
}

export function buildCamera(
  cfg: Config,
  tl: Timeline,
  layout: TemplateLayout,
  text: TextLayout,
  aspect: number,
): CameraTrack {
  const { box, centerY, fontSize } = layout;
  const frameH = 1 / aspect;

  // Wide shot: box fills ~70% of the width, but text never gets too small (portrait may overflow the frame).
  const wideZoom = Math.max(0.7 / box.w, (0.022 * frameH) / fontSize);
  const boxFits = box.w * wideZoom <= 0.92;
  const wideCx = boxFits ? box.x + box.w / 2 : layout.textX + (0.5 - 0.25) / wideZoom;
  const { compositionX, compositionY } = cfg.speed;
  // Vertical composition applies to every shot so the input line doesn't drift up/down when zooming.
  const cyAt = (zoomN: number) => centerY + ((0.5 - compositionY) * frameH) / zoomN;
  const wide: Target = { cx: wideCx, cy: cyAt(wideZoom), lz: Math.log(wideZoom) };
  const closeZoom = wideZoom * cfg.speed.closeUp;

  // Pull-back: show the whole visible line. When the box doesn't fit (portrait), zoom out further to fit the text.
  const fullLen = tl.graphemes.length;
  const visibleW = Math.min(text.prefix[fullLen], layout.areaW);
  const pullZoom = Math.min(wideZoom, 0.85 / (visibleW + 2 * fontSize));
  const pullback: Target = boxFits
    ? wide
    : { cx: layout.textX + visibleW / 2, cy: cyAt(pullZoom), lz: Math.log(pullZoom) };

  const sp = tl.speed;
  const zoomStart = Math.max(0, tl.typingStart - (cfg.cursor.blinkCount > 0 ? tl.blinkPeriod : LEAD_IN / sp));
  const pullbackAt = tl.typingEnd + IDLE_BEFORE_BLINK / sp;

  const focusX = (t: number): number => {
    const i = commitIndexAt(tl, t);
    if (i < 0) return layout.textX;
    const c = tl.commits[i];
    const wordCenter = (text.x(c.focusStart, c.len) + text.x(c.focusEnd, c.len)) / 2;
    const caret = text.x(c.len, c.len);
    return clamp(lerp(wordCenter, caret, c.caretFollow), layout.textX, layout.textX + layout.areaW);
  };

  const target = (t: number): Target => {
    // Without the opening wide shot, the camera sits on the cursor at close-up zoom from frame 0.
    if (cfg.speed.openingWide && t < zoomStart) return wide;
    if (cfg.speed.pullback && t >= pullbackAt) return pullback;
    return { cx: focusX(t) + (0.5 - compositionX) / closeZoom, cy: cyAt(closeZoom), lz: Math.log(closeZoom) };
  };

  // Critically damped springs, simulated at a fixed step so every consumer sees identical motion.
  const wPan = PAN_OMEGA[cfg.speed.cameraSensitivity] * sp;
  const wZoom = ZOOM_OMEGA * sp;
  const dt = 1 / SIM_HZ;
  const n = Math.ceil(tl.duration * SIM_HZ) + 2;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const zs = new Float32Array(n);
  const fs = new Float32Array(n);
  const wFocus = FOCUS_OMEGA * sp;
  const start = target(0);
  let x = start.cx, y = start.cy, z = start.lz, f = focusX(0);
  let vx = 0, vy = 0, vz = 0, vf = 0;
  for (let k = 0; k < n; k++) {
    xs[k] = x;
    ys[k] = y;
    zs[k] = z;
    fs[k] = f;
    const g = target(k * dt);
    vf += (wFocus * wFocus * (focusX(k * dt) - f) - 2 * wFocus * vf) * dt;
    f += vf * dt;
    vx += (wPan * wPan * (g.cx - x) - 2 * wPan * vx) * dt;
    vy += (wPan * wPan * (g.cy - y) - 2 * wPan * vy) * dt;
    vz += (wZoom * wZoom * (g.lz - z) - 2 * wZoom * vz) * dt;
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
  }

  return {
    closeZoomN: closeZoom,
    sample(t) {
      const pos = clamp(t * SIM_HZ, 0, n - 1);
      const k = Math.min(Math.floor(pos), n - 2);
      const a = pos - k;
      return {
        cx: lerp(xs[k], xs[k + 1], a),
        cy: lerp(ys[k], ys[k + 1], a),
        zoomN: Math.exp(lerp(zs[k], zs[k + 1], a)),
        fx: lerp(fs[k], fs[k + 1], a),
        fy: centerY,
      };
    },
  };
}
