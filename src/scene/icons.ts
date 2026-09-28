/** Small line icons drawn in page space, centered on (x, y). Stroke color/width come from the caller's ctx. */

type Ctx = CanvasRenderingContext2D;

function stroke(ctx: Ctx, draw: () => void) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}

export function plus(ctx: Ctx, x: number, y: number, r = 6.5) {
  stroke(ctx, () => {
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
  });
}

export function chevronDown(ctx: Ctx, x: number, y: number, r = 3.5) {
  stroke(ctx, () => {
    ctx.moveTo(x - r, y - r / 2);
    ctx.lineTo(x, y + r / 2);
    ctx.lineTo(x + r, y - r / 2);
  });
}

export function mic(ctx: Ctx, x: number, y: number) {
  stroke(ctx, () => {
    ctx.roundRect(x - 3, y - 8, 6, 10.5, 3);
    ctx.moveTo(x - 6, y - 1.5);
    ctx.arc(x, y - 1.5, 6, Math.PI, 0, true);
    ctx.moveTo(x, y + 4.5);
    ctx.lineTo(x, y + 8);
  });
}

export function laptop(ctx: Ctx, x: number, y: number) {
  stroke(ctx, () => {
    ctx.roundRect(x - 6.5, y - 5.5, 13, 9, 1.5);
    ctx.moveTo(x - 8.5, y + 5.5);
    ctx.lineTo(x + 8.5, y + 5.5);
  });
}

export function folder(ctx: Ctx, x: number, y: number) {
  stroke(ctx, () => {
    ctx.moveTo(x - 8, y + 5.5);
    ctx.lineTo(x - 8, y - 5);
    ctx.quadraticCurveTo(x - 8, y - 6.5, x - 6.5, y - 6.5);
    ctx.lineTo(x - 2.5, y - 6.5);
    ctx.lineTo(x - 0.5, y - 4.5);
    ctx.lineTo(x + 6.5, y - 4.5);
    ctx.quadraticCurveTo(x + 8, y - 4.5, x + 8, y - 3);
    ctx.lineTo(x + 8, y + 5.5);
    ctx.quadraticCurveTo(x + 8, y + 7, x + 6.5, y + 7);
    ctx.lineTo(x - 6.5, y + 7);
    ctx.quadraticCurveTo(x - 8, y + 7, x - 8, y + 5.5);
    ctx.moveTo(x - 8, y - 2);
    ctx.lineTo(x + 8, y - 2);
  });
}

export function folderPlus(ctx: Ctx, x: number, y: number) {
  folder(ctx, x, y);
  stroke(ctx, () => {
    ctx.moveTo(x - 3, y + 2.5);
    ctx.lineTo(x + 3, y + 2.5);
    ctx.moveTo(x, y - 0.5);
    ctx.lineTo(x, y + 5.5);
  });
}

/** ↵ return key */
export function returnKey(ctx: Ctx, x: number, y: number) {
  stroke(ctx, () => {
    ctx.moveTo(x + 6, y - 5);
    ctx.lineTo(x + 6, y + 1.5);
    ctx.lineTo(x - 6, y + 1.5);
    ctx.moveTo(x - 3, y - 1.5);
    ctx.lineTo(x - 6, y + 1.5);
    ctx.lineTo(x - 3, y + 4.5);
  });
}

export function ring(ctx: Ctx, x: number, y: number, r: number) {
  stroke(ctx, () => ctx.arc(x, y, r, 0, Math.PI * 2));
}

/** git branch */
export function branch(ctx: Ctx, x: number, y: number) {
  stroke(ctx, () => {
    ctx.moveTo(x - 4 + 2, y - 5.5);
    ctx.arc(x - 4, y - 5.5, 2, 0, Math.PI * 2);
    ctx.moveTo(x - 4 + 2, y + 5.5);
    ctx.arc(x - 4, y + 5.5, 2, 0, Math.PI * 2);
    ctx.moveTo(x + 4 + 2, y - 3.5);
    ctx.arc(x + 4, y - 3.5, 2, 0, Math.PI * 2);
    ctx.moveTo(x - 4, y - 3.5);
    ctx.lineTo(x - 4, y + 3.5);
    ctx.moveTo(x + 4, y - 1.5);
    ctx.quadraticCurveTo(x + 4, y + 2.5, x - 4, y + 3);
  });
}

/** shield with a small ">_" prompt (auto-approve) */
export function shieldPrompt(ctx: Ctx, x: number, y: number) {
  stroke(ctx, () => {
    ctx.moveTo(x, y - 7.5);
    ctx.lineTo(x + 6.5, y - 5);
    ctx.lineTo(x + 6.5, y + 0.5);
    ctx.quadraticCurveTo(x + 6.5, y + 5.5, x, y + 8);
    ctx.quadraticCurveTo(x - 6.5, y + 5.5, x - 6.5, y + 0.5);
    ctx.lineTo(x - 6.5, y - 5);
    ctx.closePath();
    ctx.moveTo(x - 3, y - 2);
    ctx.lineTo(x - 1, y);
    ctx.lineTo(x - 3, y + 2);
    ctx.moveTo(x + 0.5, y + 2.5);
    ctx.lineTo(x + 3, y + 2.5);
  });
}

/** voice waveform: vertical bars */
export function waveform(ctx: Ctx, x: number, y: number) {
  const bars = [3, 7, 10, 7, 4];
  stroke(ctx, () => {
    bars.forEach((h, i) => {
      const bx = x + (i - 2) * 3;
      ctx.moveTo(bx, y - h / 2);
      ctx.lineTo(bx, y + h / 2);
    });
  });
}

/** Pixel crab mascot; `#` = body, `e` = eye. Bottom edge sits at y. */
const CRAB = [
  '..########..',
  '..#e####e#..',
  '############',
  '############',
  '..########..',
  '..########..',
  '..#.#..#.#..',
  '..#.#..#.#..',
];

export function pixelCrab(ctx: Ctx, x: number, bottom: number, unit: number, body: string, eye: string) {
  const top = bottom - CRAB.length * unit;
  CRAB.forEach((row, r) => {
    [...row].forEach((c, col) => {
      if (c === '.') return;
      ctx.fillStyle = c === 'e' ? eye : body;
      // tiny overlap avoids hairline seams between pixels at fractional zoom
      ctx.fillRect(x + col * unit, top + r * unit, unit + 0.05, unit + 0.05);
    });
  });
}
