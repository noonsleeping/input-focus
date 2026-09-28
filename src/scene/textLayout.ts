import type { TemplateLayout } from './templates/types';

const CARET_PAD = 2;

export interface TextLayout {
  font: string;
  /** prefix[i] = width of the first i graphemes */
  prefix: Float64Array;
  /** width of one "average" character, used for block/underline cursors */
  cellW: number;
  /** horizontal scroll of the single-line input when `len` graphemes are visible */
  scroll(len: number): number;
  /** page-space x of the boundary before grapheme i, while `len` graphemes are visible */
  x(i: number, len: number): number;
}

let measureCtx: CanvasRenderingContext2D | null = null;

export function createTextLayout(graphemes: string[], layout: TemplateLayout): TextLayout {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  const font = `${layout.fontSize}px ${layout.fontFamily}`;
  measureCtx.font = font;
  const prefix = new Float64Array(graphemes.length + 1);
  let s = '';
  for (let i = 0; i < graphemes.length; i++) {
    s += graphemes[i];
    prefix[i + 1] = measureCtx.measureText(s).width;
  }
  const cellW = measureCtx.measureText('a').width;

  const scroll = (len: number) => Math.max(0, prefix[len] - (layout.areaW - CARET_PAD));
  return {
    font,
    prefix,
    cellW,
    scroll,
    x: (i, len) => layout.textX + prefix[i] - scroll(len),
  };
}
