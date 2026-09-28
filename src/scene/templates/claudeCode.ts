import type { Template, TemplateLayout } from './types';
import { FONT_SANS } from '../draw';
import * as icon from '../icons';

// Measured from a 2× screenshot of the desktop app's prompt box, in page px relative to the input box.
const PAGE_W = 1440;
const BOX_W = 768;
const BOX_H = 41;
const BOX_Y = 420;
const TEXT_X = 13;
const CHIP_Y = -33.5;
const CHIP_H = 23;
const ROW_Y = 56.5; // bottom toolbar center

const INK = '#3d3d3a';
const MUTED = '#9b9892';
const BORDER = '#dedcd5';
const ORANGE = '#d97757';

export const claudeCode: Template = {
  id: 'claude-code',
  name: 'Claude Code',
  titleLabel: '标题',
  modelPresets: ['Opus 5.5', 'Sonnet 5', 'Haiku 4.5', 'Fable 5.1'],

  layout(cfg): TemplateLayout {
    const x = (PAGE_W - BOX_W) / 2;
    return {
      box: { x, y: BOX_Y, w: BOX_W, h: BOX_H },
      textX: x + TEXT_X,
      areaW: BOX_W - TEXT_X - 44,
      centerY: BOX_Y + BOX_H / 2,
      fontSize: 15 * cfg.template.fontScale,
      fontFamily: FONT_SANS,
      textColor: '#1f1e1d',
      placeholderColor: MUTED,
      caretColor: '#1f1e1d',
      placeholder: 'Describe a task or ask a question',
    };
  },

  drawPage(ctx, { zoom, cfg, layout }) {
    const { box, centerY } = layout;
    const bx = box.x;
    const by = box.y;

    ctx.fillStyle = '#f7f7f5';
    ctx.fillRect(-1e5, -1e5, 2e5, 2e5);

    if (cfg.template.logoText.trim()) {
      ctx.fillStyle = '#1f1e1d';
      ctx.font = `500 26px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(cfg.template.logoText, bx + 4, by + CHIP_Y - 28);
    }

    ctx.font = `14px ${FONT_SANS}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineWidth = 1.3;

    // Chips: [laptop Local] [folder fast input] [folder+]
    const chipCy = by + CHIP_Y + CHIP_H / 2;
    const chip = (x: number, w: number) => {
      ctx.fillStyle = '#fdfdfc';
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, by + CHIP_Y + 0.5, w - 1, CHIP_H - 1, 5);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
    };
    const labeled = (x: number, label: string, draw: typeof icon.laptop) => {
      const w = 27.5 + ctx.measureText(label).width + 12;
      chip(x, w);
      draw(ctx, x + 13.5, chipCy);
      ctx.fillStyle = INK;
      ctx.fillText(label, x + 27.5, chipCy);
      return x + w + 6.5;
    };
    let cx = bx + 1;
    cx = labeled(cx, 'Local', icon.laptop);
    cx = labeled(cx, 'default folder', icon.folder);
    chip(cx, 27);
    icon.folderPlus(ctx, cx + 13.5, chipCy);

    // Mascot sits on the top-right edge of the input
    icon.pixelCrab(ctx, bx + 728, by + 0.5, 35 / 12, ORANGE, '#1a1a1a');

    // Input box
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.04)';
    ctx.shadowBlur = 6 * zoom;
    ctx.shadowOffsetY = 1 * zoom;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(bx, by, BOX_W, BOX_H, 10);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#d6d4cc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx + 0.5, by + 0.5, BOX_W - 1, BOX_H - 1, 10);
    ctx.stroke();

    ctx.strokeStyle = '#a5a39c';
    ctx.lineWidth = 1.3;
    icon.returnKey(ctx, bx + 748, centerY);

    // Bottom toolbar
    const rowY = by + ROW_Y;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    icon.plus(ctx, bx + 17.5, rowY);
    icon.mic(ctx, bx + 37.5, rowY);
    icon.chevronDown(ctx, bx + 56, rowY);
    ctx.fillStyle = INK;
    ctx.fillText('Auto', bx + 73, rowY);

    ctx.textAlign = 'right';
    ctx.fillText('High', bx + 728, rowY);
    const highW = ctx.measureText('High').width;
    ctx.fillText(cfg.template.model['claude-code'], bx + 728 - highW - 17, rowY);
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#c9c7c0';
    ctx.lineWidth = 1.2;
    icon.ring(ctx, bx + 748.5, rowY, 5.5);
  },
};
