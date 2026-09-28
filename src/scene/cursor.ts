import type { Config } from '../config';
import { IDLE_BEFORE_BLINK, type Timeline } from '../timeline/rhythm';

function blink(phase: number, style: Config['cursor']['blinkStyle']): number {
  // Each cycle starts "off", so N cycles read as N visible blinks.
  if (style === 'hard') return phase < 0.5 ? 0 : 1;
  // Smooth: fades out then back in over one cycle (1 → 0 → 1).
  return 0.5 + 0.5 * Math.cos(2 * Math.PI * phase);
}

/** Cursor opacity at time t: solid during lead-in and typing, blinking before typing and after idling. */
export function cursorOpacity(t: number, tl: Timeline, style: Config['cursor']['blinkStyle']): number {
  const P = tl.blinkPeriod;
  if (t < tl.leadIn) return 1;
  if (t < tl.typingStart) return blink(((t - tl.leadIn) % P) / P, style);
  const idleFrom = tl.typingEnd + IDLE_BEFORE_BLINK / tl.speed;
  if (t < idleFrom) return 1;
  return blink(((t - idleFrom) % P) / P, style);
}

export function drawCursor(
  ctx: CanvasRenderingContext2D,
  shape: Config['cursor']['shape'],
  x: number,
  centerY: number,
  fontSize: number,
  cellW: number,
  color: string,
  opacity: number,
) {
  if (opacity <= 0.001) return;
  const h = fontSize * 1.25;
  const top = centerY - h / 2;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  switch (shape) {
    case 'thin':
      ctx.fillRect(x - 0.6, top, 1.2, h);
      break;
    case 'thick':
      ctx.fillRect(x - 1.25, top, 2.5, h);
      break;
    case 'underline':
      ctx.fillRect(x, centerY + fontSize * 0.55, cellW, fontSize * 0.1);
      break;
    case 'block':
      ctx.fillRect(x, top, cellW, h);
      break;
    case 'hollow':
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 0.6, top + 0.6, cellW - 1.2, h - 1.2);
      break;
  }
  ctx.restore();
}
