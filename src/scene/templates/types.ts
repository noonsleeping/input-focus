import type { Config } from '../../config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** All coordinates are in page (logical CSS px) space; the camera maps them to output pixels. */
export interface TemplateLayout {
  box: Rect;
  /** left edge of the text area */
  textX: number;
  /** width of the visible text area; longer text scrolls left */
  areaW: number;
  /** vertical center of the text line */
  centerY: number;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  placeholderColor: string;
  caretColor: string;
  /** placeholder shown when the config doesn't set one */
  placeholder?: string;
}

export interface DrawEnv {
  /** output px per page px — for effects (like shadowBlur) that ignore the canvas transform */
  zoom: number;
  cfg: Config;
  layout: TemplateLayout;
  /** graphemes currently typed (e.g. a send button lights up once there is text) */
  len: number;
}

export interface Template {
  id: string;
  name: string;
  /** label for the optional big text above the box (logo for search pages, greeting for chat) */
  titleLabel: string;
  /** templates with a model picker list their presets here */
  modelPresets?: string[];
  layout(cfg: Config): TemplateLayout;
  /** Draw everything except the typed text and cursor. */
  drawPage(ctx: CanvasRenderingContext2D, env: DrawEnv): void;
}
