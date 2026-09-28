import type { Template, TemplateLayout } from './types';
import { FONT_SANS, roundRect } from '../draw';

const PAGE_W = 1440;
const BOX_W = 584;
const BOX_H = 48;
const BOX_Y = 380;
const ICON_PAD = 52;

export const searchPill: Template = {
  id: 'search-pill',
  name: '搜索 · 胶囊式',
  titleLabel: 'Logo 文字',

  layout(cfg): TemplateLayout {
    const box = { x: (PAGE_W - BOX_W) / 2, y: BOX_Y, w: BOX_W, h: BOX_H };
    return {
      box,
      textX: box.x + ICON_PAD,
      areaW: box.w - ICON_PAD * 2,
      centerY: box.y + box.h / 2,
      fontSize: 16 * cfg.template.fontScale,
      fontFamily: FONT_SANS,
      textColor: '#202124',
      placeholderColor: '#9aa0a6',
      caretColor: '#202124',
    };
  },

  drawPage(ctx, { zoom, cfg, layout }) {
    const { box, centerY } = layout;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1e5, -1e5, 2e5, 2e5);

    if (cfg.template.logoText.trim()) {
      ctx.fillStyle = '#3c4043';
      ctx.font = `500 64px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(cfg.template.logoText, PAGE_W / 2, box.y - 64);
      ctx.textAlign = 'left';
    }

    // Focused search box: soft shadow, no visible border.
    ctx.save();
    ctx.shadowColor = 'rgba(32,33,36,0.28)';
    ctx.shadowBlur = 6 * zoom;
    ctx.shadowOffsetY = 1 * zoom;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, box.x, box.y, box.w, box.h, box.h / 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(223,225,229,0.6)';
    ctx.lineWidth = 1;
    roundRect(ctx, box.x, box.y, box.w, box.h, box.h / 2);
    ctx.stroke();

    // Magnifier
    const mx = box.x + 24;
    ctx.strokeStyle = '#9aa0a6';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(mx - 1.5, centerY - 1.5, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx + 3, centerY + 3);
    ctx.lineTo(mx + 7.5, centerY + 7.5);
    ctx.stroke();

    // Microphone (generic)
    const cx = box.x + box.w - 26;
    ctx.fillStyle = '#9aa0a6';
    roundRect(ctx, cx - 3.5, centerY - 10, 7, 12, 3.5);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, centerY - 3, 6.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, centerY + 3.5);
    ctx.lineTo(cx, centerY + 8);
    ctx.stroke();
    ctx.lineCap = 'butt';
  },
};
