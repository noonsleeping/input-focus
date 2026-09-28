import type { Template, TemplateLayout } from './types';
import { FONT_SANS } from '../draw';
import * as icon from '../icons';

// Measured from a 2× screenshot of the app's composer, in page px relative to the white card.
const PAGE_W = 1440;
const CARD_W = 736;
const CARD_H = 98;
const CARD_Y = 420;
const TEXT_X = 12;
const TEXT_CY = 24;
const TOP_BAR = { x: 13.5, y: -37.5, w: 709, h: 60 };
const TOP_ROW_Y = -19;
const ROW_Y = 76; // bottom toolbar center

const INK = '#2f2f2f';
const MUTED = '#a3a3a3';

export const codex: Template = {
  id: 'codex',
  name: 'Codex',
  titleLabel: '标题',
  modelPresets: ['GPT-6 Sol'],

  layout(cfg): TemplateLayout {
    const x = (PAGE_W - CARD_W) / 2;
    return {
      box: { x, y: CARD_Y, w: CARD_W, h: CARD_H },
      textX: x + TEXT_X,
      areaW: CARD_W - TEXT_X * 2,
      centerY: CARD_Y + TEXT_CY,
      fontSize: 14 * cfg.template.fontScale,
      fontFamily: FONT_SANS,
      textColor: '#0d0d0d',
      placeholderColor: '#b8b8b8',
      caretColor: '#0d0d0d',
      placeholder: '随心输入',
    };
  },

  drawPage(ctx, { zoom, cfg, layout }) {
    const { box } = layout;
    const cx = box.x;
    const cy = box.y;

    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(-1e5, -1e5, 2e5, 2e5);

    if (cfg.template.logoText.trim()) {
      ctx.fillStyle = '#0d0d0d';
      ctx.font = `500 26px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(cfg.template.logoText, cx + TOP_BAR.x + 6, cy + TOP_BAR.y - 26);
    }

    // Gray context bar behind the card: [folder 选择文件夹] [laptop 本地] [branch master]
    ctx.fillStyle = '#f3f3f3';
    ctx.beginPath();
    ctx.roundRect(cx + TOP_BAR.x, cy + TOP_BAR.y, TOP_BAR.w, TOP_BAR.h, 14);
    ctx.fill();

    ctx.font = `13px ${FONT_SANS}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 1.3;
    const rowY = cy + TOP_ROW_Y;
    let x = cx + 34;
    for (const [draw, label] of [
      [icon.folder, '选择文件夹'],
      [icon.laptop, '本地'],
      [icon.branch, 'master'],
    ] as const) {
      draw(ctx, x, rowY);
      ctx.fillText(label, x + 14, rowY);
      x += 14 + ctx.measureText(label).width + 33;
    }

    // White card
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 16 * zoom;
    ctx.shadowOffsetY = 2 * zoom;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cx, cy, CARD_W, CARD_H, 15);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ebebeb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx + 0.5, cy + 0.5, CARD_W - 1, CARD_H - 1, 15);
    ctx.stroke();

    // Bottom toolbar
    const by = cy + ROW_Y;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    icon.plus(ctx, cx + 22, by, 7);
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 1.2;
    icon.shieldPrompt(ctx, cx + 55.5, by);
    ctx.fillStyle = MUTED;
    ctx.font = `13px ${FONT_SANS}`;
    ctx.fillText('帮我批准', cx + 68, by);

    ctx.font = `14px ${FONT_SANS}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.fillText(cfg.template.model.codex, cx + 615, by);
    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.fillText('高', cx + 622.5, by);
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 1.2;
    icon.chevronDown(ctx, cx + 646.5, by);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    icon.mic(ctx, cx + 677.5, by);

    ctx.fillStyle = '#0d0d0d';
    ctx.beginPath();
    ctx.arc(cx + 714, by, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    icon.waveform(ctx, cx + 714, by);
  },
};
