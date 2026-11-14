// The Amsler grid (doc 09 §3.2): 20 × 20 squares of 5 mm = 100 mm, sized from the screen calibration (CSS px per
// mm), black lines on white whatever the theme, central fixation dot. One canvas: the backing store is drawn in
// device pixels (× devicePixelRatio) for crisp lines; the CSS size carries the physical size.
// Input: pointer (mouse / touch / pen) drag-to-paint; keyboard — arrow keys move a cell cursor, Space or Enter
// toggles the cell with the current brush. The 5-mm cells are smaller than 44 px by specification; the whole grid is
// one large target and the keyboard path reaches every cell.
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import {
  AMSLER_GRID_MM,
  AMSLER_N,
  amslerGridPx,
  cellAtPoint,
  cellIndex,
  cellRowCol,
  type AmslerCells,
} from '../../../measurement/vision';
import { KIND_STYLE, NEW_OUTLINE } from './kinds';


export interface AmslerGridProps {
  pxPerMm: number;
  cells: AmslerCells;
  /** Highlighted (outlined) cells, e.g. new area since the last test. */
  highlight?: readonly number[];
  /** Paint a cell during a stroke; omitted → read-only. */
  onPaint?: (index: number, phase: 'start' | 'move') => void;
  /** Keyboard toggle of a cell. */
  onToggle?: (index: number) => void;
  /** End of a pointer stroke (one undo step). */
  onStrokeEnd?: () => void;
  label: string;
  /** Scale factor for small read-only previews (1 = physical 100 mm). */
  scale?: number;
  testId?: string;
}

function draw(canvas: HTMLCanvasElement, sizeCss: number, cells: AmslerCells, highlight: readonly number[], cursor: number | null) {
  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(sizeCss * dpr);
  if (canvas.width !== px) canvas.width = px;
  if (canvas.height !== px) canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cell = px / AMSLER_N;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, px, px);
  cells.forEach((k, i) => {
    if (!k) return;
    const { row, col } = cellRowCol(i);
    ctx.fillStyle = KIND_STYLE[k].fill;
    ctx.fillRect(col * cell, row * cell, cell, cell);
    if (cell >= 14 * dpr) {
      ctx.fillStyle = k === 'missing' ? '#FFFFFF' : '#000000';
      ctx.font = `600 ${Math.round(cell * 0.55)}px "IBM Plex Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(KIND_STYLE[k].letter, col * cell + cell / 2, row * cell + cell / 2 + 1);
    }
  });
  const line = Math.max(1, Math.round(dpr));
  ctx.fillStyle = '#000000';
  for (let k = 0; k <= AMSLER_N; k += 1) {
    const p = Math.min(px - line, Math.round(k * cell - line / 2));
    ctx.fillRect(Math.max(0, p), 0, line, px);
    ctx.fillRect(0, Math.max(0, p), px, line);
  }
  ctx.beginPath();
  ctx.arc(px / 2, px / 2, Math.max(3 * dpr, cell * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, Math.round(2.5 * dpr));
  ctx.strokeStyle = NEW_OUTLINE;
  for (const i of highlight) {
    const { row, col } = cellRowCol(i);
    ctx.strokeRect(col * cell + ctx.lineWidth / 2, row * cell + ctx.lineWidth / 2, cell - ctx.lineWidth, cell - ctx.lineWidth);
  }
  if (cursor !== null) {
    const { row, col } = cellRowCol(cursor);
    ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
    ctx.strokeStyle = '#1652F0';
    ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.strokeRect(col * cell + 1, row * cell + 1, cell - 2, cell - 2);
    ctx.setLineDash([]);
  }
}

export function AmslerGrid({ pxPerMm, cells, highlight = [], onPaint, onToggle, onStrokeEnd, label, scale = 1, testId = 'amsler-grid' }: AmslerGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState(cellIndex(AMSLER_N / 2 - 1, AMSLER_N / 2 - 1));
  const [focused, setFocused] = useState(false);
  const painting = useRef(false);
  const gridPx = amslerGridPx(pxPerMm) * scale;
  const interactive = onPaint !== undefined;

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, gridPx, cells, highlight, interactive && focused ? cursor : null);
  }, [gridPx, cells, highlight, cursor, focused, interactive]);

  const cellOf = (e: PointerEvent<HTMLCanvasElement>): number | null => {
    const r = e.currentTarget.getBoundingClientRect();
    return cellAtPoint(e.clientX - r.left, e.clientY - r.top, r.width);
  };
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!onPaint) return;
    const i = cellOf(e);
    if (i === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    painting.current = true;
    setCursor(i);
    onPaint(i, 'start');
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current || !onPaint) return;
    const i = cellOf(e);
    if (i !== null) onPaint(i, 'move');
  };
  const up = () => {
    if (!painting.current) return;
    painting.current = false;
    onStrokeEnd?.();
  };
  const key = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const { row, col } = cellRowCol(cursor);
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      const r = Math.min(AMSLER_N - 1, Math.max(0, row + m[0]));
      const c = Math.min(AMSLER_N - 1, Math.max(0, col + m[1]));
      setCursor(cellIndex(r, c));
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onToggle?.(cursor);
    }
  };
  const { row, col } = cellRowCol(cursor);
  const at = cells[cursor];

  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className="max-w-full overflow-auto rounded-sm bg-white p-2 [color-scheme:light]"
        data-testid={testId}
        data-grid-mm={AMSLER_GRID_MM * scale}
        data-grid-px={gridPx}
        data-px-per-mm={pxPerMm}
      >
        <canvas
          ref={canvasRef}
          role={interactive ? 'application' : 'img'}
          aria-roledescription={interactive ? 'Amsler grid' : undefined}
          aria-label={label}
          tabIndex={interactive ? 0 : undefined}
          style={{ width: gridPx, height: gridPx, touchAction: 'none', display: 'block' }}
          className="cursor-crosshair outline-offset-4 focus-visible:outline-3 focus-visible:outline-brand"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={interactive ? key : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      {interactive && (
        <p aria-live="polite" className="text-sm text-text-2" data-testid="amsler-cursor">
          {focused ? `Row ${row + 1}, column ${col + 1}: ${at ? KIND_STYLE[at].label.toLowerCase() : 'not marked'}.` : 'Tab to the grid to use the arrow keys and Space.'}
        </p>
      )}
    </div>
  );
}
