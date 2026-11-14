// Canvas overlay on top of the live video: ROI tint (always) and, with ?debug=rppg, the three ROI boxes plus the
// nine landmark points with their index numbers so a human can confirm the indices (doc 09 §1.2).
// Draws only geometry onto a visible canvas; it never reads pixels back.
import { ANALYSIS_H, ANALYSIS_W } from '../../../measurement/rppg/capture';
import type { Box, RoiResult } from '../../../measurement/rppg/roi';

export interface OverlayOptions {
  debug: boolean;
  mirrored: boolean;
}

const TINT = 'rgba(45, 212, 191, 0.28)';
const LINE = 'rgba(45, 212, 191, 0.95)';
const MISS = 'rgba(245, 184, 61, 0.95)';

const BOX_NAMES = ['forehead', 'cheek A (33/61)', 'cheek B (263/291)'] as const;

export function drawOverlay(canvas: HTMLCanvasElement, roi: RoiResult | null, opts: OverlayOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / ANALYSIS_W;
  const sy = h / ANALYSIS_H;
  const X = (x: number) => (opts.mirrored ? w - x * sx : x * sx);
  const Y = (y: number) => y * sy;
  ctx.clearRect(0, 0, w, h);

  // Face guide oval: where the face should be.
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = roi?.ok ? LINE : MISS;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.2, h * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (!roi) return;
  const boxes: Array<Box | null> = [roi.forehead, roi.leftCheek, roi.rightCheek];
  boxes.forEach((b, i) => {
    if (!b) return;
    const x0 = Math.min(X(b.x0), X(b.x1));
    const x1 = Math.max(X(b.x0), X(b.x1));
    ctx.fillStyle = roi.ok ? TINT : 'rgba(245, 184, 61, 0.2)';
    ctx.fillRect(x0, Y(b.y0), x1 - x0, Y(b.y1) - Y(b.y0));
    if (opts.debug) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = roi.ok ? LINE : MISS;
      ctx.strokeRect(x0, Y(b.y0), x1 - x0, Y(b.y1) - Y(b.y0));
      label(ctx, BOX_NAMES[i] ?? '', x0 + 2, Y(b.y0) - 6, 13);
    }
  });

  if (!opts.debug) return;
  for (const p of roi.points) {
    const x = X(p.x);
    const y = Y(p.y);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5a5f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    label(ctx, String(p.index), x + 8, y - 8, 18);
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.font = `600 ${size}px 'IBM Plex Mono', ui-monospace, monospace`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}
