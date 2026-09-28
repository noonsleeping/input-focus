import { renderKeyTrack } from './audio/synth';
import type { Config } from './config';
import { needsPostFx, PostFx } from './fx/postfx';
import { buildCamera, type CameraTrack } from './camera/camera';
import { cursorOpacity, drawCursor } from './scene/cursor';
import { getTemplate } from './scene/templates';
import type { Template, TemplateLayout } from './scene/templates/types';
import { createTextLayout, type TextLayout } from './scene/textLayout';
import { buildTimeline, commitIndexAt, type Timeline } from './timeline/rhythm';

export interface Scene {
  cfg: Config;
  template: Template;
  layout: TemplateLayout;
  text: TextLayout;
  timeline: Timeline;
  camera: CameraTrack;
  /** mono key-sound track at SAMPLE_RATE, or null when sound is off */
  audio: Float32Array | null;
}

export function buildScene(cfg: Config): Scene {
  const template = getTemplate(cfg.template.id);
  const layout = template.layout(cfg);
  const timeline = buildTimeline(cfg);
  const text = createTextLayout(timeline.graphemes, layout);
  const aspect = cfg.output.width / cfg.output.height;
  const camera = buildCamera(cfg, timeline, layout, text, aspect);
  const audio = cfg.audio.enabled ? renderKeyTrack(timeline.keystrokes, timeline.duration, cfg.audio, cfg.seed) : null;
  return { cfg, template, layout, text, timeline, camera, audio };
}

/** Pure function of (scene, t): preview, scrubbing and export all go through here. */
export function renderFrame(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene, t: number) {
  const { cfg, template, layout, text, timeline } = scene;
  const cam = scene.camera.sample(t);
  const zoom = cam.zoomN * W;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(zoom, 0, 0, zoom, W / 2 - cam.cx * zoom, H / 2 - cam.cy * zoom);

  const ci = commitIndexAt(timeline, t);
  const len = ci < 0 ? 0 : timeline.commits[ci].len;

  template.drawPage(ctx, { zoom, cfg, layout, len });

  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.textX - 1, layout.box.y, layout.areaW + 2, layout.box.h);
  ctx.clip();
  ctx.font = text.font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (len > 0) {
    ctx.fillStyle = layout.textColor;
    // Commits still animating in are drawn separately; everything before them is one settled run.
    const fadeDur = cfg.charAnim.mode === 'none' ? 0 : cfg.charAnim.duration / timeline.speed;
    let first = ci;
    while (fadeDur > 0 && first >= 0 && t - timeline.commits[first].t < fadeDur) first--;
    const settled = first < 0 ? 0 : timeline.commits[first].len;
    if (settled > 0) ctx.fillText(timeline.graphemes.slice(0, settled).join(''), text.x(0, len), layout.centerY);
    for (let i = first + 1; i <= ci; i++) {
      const from = i > 0 ? timeline.commits[i - 1].len : 0;
      const c = timeline.commits[i];
      const p = 1 - Math.pow(1 - Math.min((t - c.t) / fadeDur, 1), 3); // ease-out cubic
      const dy = cfg.charAnim.mode === 'rise' ? (1 - p) * layout.fontSize * 0.3 : 0;
      ctx.globalAlpha = p;
      ctx.fillText(timeline.graphemes.slice(from, c.len).join(''), text.x(from, len), layout.centerY + dy);
    }
    ctx.globalAlpha = 1;
  } else if (cfg.placeholder || layout.placeholder) {
    ctx.fillStyle = layout.placeholderColor;
    ctx.fillText(cfg.placeholder || layout.placeholder!, layout.textX, layout.centerY);
  }
  ctx.restore();

  drawCursor(
    ctx,
    cfg.cursor.shape,
    text.x(len, len),
    layout.centerY,
    layout.fontSize,
    text.cellW,
    cfg.cursor.color ?? layout.caretColor,
    cursorOpacity(t, timeline, cfg.cursor.blinkStyle),
  );
}

/**
 * Draws a frame into `target`, routing through the WebGL post chain when a screen or lens effect is enabled.
 * Owns its offscreen canvases, so use one instance per output (preview, export).
 */
export class FrameRenderer {
  private sceneCanvas: HTMLCanvasElement | null = null;
  private fx: PostFx | null = null;

  draw(target: CanvasRenderingContext2D, W: number, H: number, scene: Scene, t: number) {
    if (!needsPostFx(scene.cfg)) {
      renderFrame(target, W, H, scene, t);
      return;
    }
    const sc = (this.sceneCanvas ??= document.createElement('canvas'));
    if (sc.width !== W || sc.height !== H) {
      sc.width = W;
      sc.height = H;
    }
    renderFrame(sc.getContext('2d', { alpha: false })!, W, H, scene, t);
    const cam = scene.camera.sample(t);
    const zoom = cam.zoomN * W;
    const out = (this.fx ??= new PostFx()).render(sc, W, H, {
      screen: scene.cfg.screen,
      lens: scene.cfg.lens,
      zoom,
      cx: cam.cx,
      cy: cam.cy,
      closeZoom: scene.camera.closeZoomN * W,
      focus: [(cam.fx - cam.cx) * zoom + W / 2, (cam.fy - cam.cy) * zoom + H / 2],
      time: t,
    });
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.drawImage(out, 0, 0);
  }

  dispose() {
    this.fx?.dispose();
    this.fx = null;
    this.sceneCanvas = null;
  }
}
