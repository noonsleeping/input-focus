import type { Template, TemplateLayout } from './types';
import { FONT_SANS, roundRect } from '../draw';

const PAGE_W = 1440;
const BOX_W = 720;
const BOX_H = 56;
const BOX_Y = 420;
const LEFT_PAD = 52;
const RIGHT_PAD = 60;

interface Theme {
  page: string;
  box: string;
  border: string | null;
  shadow: string;
  text: string;
  placeholder: string;
  icon: string;
  sendOn: [fill: string, arrow: string];
  sendOff: [fill: string, arrow: string];
}

const LIGHT: Theme = {
  page: '#ffffff',
  box: '#ffffff',
  border: '#e3e3e3',
  shadow: 'rgba(0,0,0,0.08)',
  text: '#0d0d0d',
  placeholder: '#8f8f8f',
  icon: '#5d5d5d',
  sendOn: ['#0d0d0d', '#ffffff'],
  sendOff: ['#d7d7d7', '#ffffff'],
};

const DARK: Theme = {
  page: '#212121',
  box: '#303030',
  border: null,
  shadow: 'rgba(0,0,0,0.3)',
  text: '#ececec',
  placeholder: '#9b9b9b',
  icon: '#b4b4b4',
  sendOn: ['#ececec', '#212121'],
  sendOff: ['#676767', '#303030'],
};

/** Centered chat composer (new-conversation layout) with "+" and a send button. */
function aiChat(id: string, name: string, theme: Theme): Template {
  return {
    id,
    name,
    titleLabel: '欢迎语',

    layout(cfg): TemplateLayout {
      const x = (PAGE_W - BOX_W) / 2;
      return {
        box: { x, y: BOX_Y, w: BOX_W, h: BOX_H },
        textX: x + LEFT_PAD,
        areaW: BOX_W - LEFT_PAD - RIGHT_PAD,
        centerY: BOX_Y + BOX_H / 2,
        fontSize: 16 * cfg.template.fontScale,
        fontFamily: FONT_SANS,
        textColor: theme.text,
        placeholderColor: theme.placeholder,
        caretColor: theme.text,
      };
    },

    drawPage(ctx, { zoom, cfg, layout, len }) {
      const { box, centerY } = layout;

      ctx.fillStyle = theme.page;
      ctx.fillRect(-1e5, -1e5, 2e5, 2e5);

      // Left-aligned with the box so it stays in frame when portrait framing anchors on the cursor.
      if (cfg.template.logoText.trim()) {
        ctx.fillStyle = theme.text;
        ctx.font = `500 28px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(cfg.template.logoText, box.x + 20, box.y - 36);
      }

      ctx.save();
      ctx.shadowColor = theme.shadow;
      ctx.shadowBlur = 14 * zoom;
      ctx.shadowOffsetY = 3 * zoom;
      ctx.fillStyle = theme.box;
      roundRect(ctx, box.x, box.y, box.w, box.h, box.h / 2);
      ctx.fill();
      ctx.restore();
      if (theme.border) {
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 1;
        roundRect(ctx, box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1, box.h / 2);
        ctx.stroke();
      }

      // "+" attach button
      const px = box.x + 26;
      ctx.strokeStyle = theme.icon;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px - 7, centerY);
      ctx.lineTo(px + 7, centerY);
      ctx.moveTo(px, centerY - 7);
      ctx.lineTo(px, centerY + 7);
      ctx.stroke();

      // Send button: enabled once there is text
      const [fill, arrow] = len > 0 ? theme.sendOn : theme.sendOff;
      const sx = box.x + box.w - 30;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(sx, centerY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = arrow;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, centerY + 7);
      ctx.lineTo(sx, centerY - 7);
      ctx.moveTo(sx - 6, centerY - 1);
      ctx.lineTo(sx, centerY - 7);
      ctx.lineTo(sx + 6, centerY - 1);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    },
  };
}

export const aiLight = aiChat('ai-light', 'AI 对话 · 浅色', LIGHT);
export const aiDark = aiChat('ai-dark', 'AI 对话 · 深色', DARK);
