import type { Template, TemplateLayout } from './types';
import { FONT_SANS } from '../draw';

const PAGE_W = 1440;
const INPUT_W = 520;
const BUTTON_W = 108;
const BOX_H = 44;
const BOX_Y = 380;
const PAD = 14;
const ACCENT = '#3b6cf6';

export const searchButton: Template = {
  id: 'search-button',
  name: '搜索 · 按钮式',
  titleLabel: 'Logo 文字',

  layout(cfg): TemplateLayout {
    const x = (PAGE_W - INPUT_W - BUTTON_W) / 2;
    return {
      box: { x, y: BOX_Y, w: INPUT_W + BUTTON_W, h: BOX_H },
      textX: x + PAD,
      areaW: INPUT_W - PAD * 2,
      centerY: BOX_Y + BOX_H / 2,
      fontSize: 16 * cfg.template.fontScale,
      fontFamily: FONT_SANS,
      textColor: '#222222',
      placeholderColor: '#a0a0a0',
      caretColor: '#222222',
    };
  },

  drawPage(ctx, { cfg, layout }) {
    const { box, centerY } = layout;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1e5, -1e5, 2e5, 2e5);

    if (cfg.template.logoText.trim()) {
      ctx.fillStyle = '#222222';
      ctx.font = `600 60px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(cfg.template.logoText, PAGE_W / 2, box.y - 56);
      ctx.textAlign = 'left';
    }

    // Focused input: accent border, square join with the button
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, INPUT_W, BOX_H, [10, 0, 0, 10]);
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(box.x + 1, box.y + 1, INPUT_W - 1, BOX_H - 2, [9, 0, 0, 9]);
    ctx.stroke();

    // Button
    const bx = box.x + INPUT_W;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.roundRect(bx, box.y, BUTTON_W, BOX_H, [0, 10, 10, 0]);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `500 17px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('搜索', bx + BUTTON_W / 2, centerY);
    ctx.textAlign = 'left';
  },
};
