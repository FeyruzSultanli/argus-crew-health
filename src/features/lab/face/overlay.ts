// Canvas overlay over the live video of the face scan: a face guide oval (always) and, with ?debug=face, the ten
// landmarks the scan uses with their index numbers and the measured segments (IPD, cheek, jaw, two lid distances),
// so a human can confirm the indices on a real face (like ?debug=rppg). Draws geometry only; never reads pixels.
import { FACE_SCAN_LANDMARKS, FACE_SEGMENTS } from '../../../measurement/face/geometry';
import type { NormLandmark } from '../../../measurement/rppg/roi';

const OK = 'rgba(45, 212, 191, 0.95)';
const MISS = 'rgba(245, 184, 61, 0.95)';
const SEG_COLOR: Record<string, string> = {
  IPD: '#7dd3fc',
  cheek: '#facc15',
  jaw: '#f472b6',
  'eye R': '#a7f3d0',
  'eye L': '#a7f3d0',
};

export function drawFaceOverlay(
  canvas: HTMLCanvasElement,
  landmarks: NormLandmark[] | null,
  opts: { debug: boolean; mirrored: boolean; accepted: boolean },
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const X = (x: number) => (opts.mirrored ? w - x * w : x * w);
  const Y = (y: number) => y * h;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = landmarks && opts.accepted ? OK : MISS;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.2, h * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (!opts.debug || !landmarks) return;
  for (const s of FACE_SEGMENTS) {
    const a = landmarks[s.a];
    const b = landmarks[s.b];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    ctx.lineTo(X(b.x), Y(b.y));
    ctx.lineWidth = 2;
    ctx.strokeStyle = SEG_COLOR[s.name] ?? OK;
    ctx.stroke();
    label(ctx, s.name, (X(a.x) + X(b.x)) / 2 + 4, (Y(a.y) + Y(b.y)) / 2 - 6, 12);
  }
  for (const i of FACE_SCAN_LANDMARKS) {
    const p = landmarks[i];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5a5f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    label(ctx, String(i), X(p.x) + 7, Y(p.y) - 7, 15);
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
