// Amsler grid geometry, bitmasks and the diff vs the previous map (doc 09 §3.2, doc 07 §4.10). Pure TypeScript.
// Grid: 20 × 20 squares of 5 mm (= 100 mm) computed from the screen's CSS px per mm; fixation dot at the centre,
// which is the crossing of the lines between cells 10 and 11 (1-based) in both directions. Cells are indexed
// row-major from the top-left, 0-based: index = row · 20 + col.
// "Central" = Chebyshev distance ≤ 2 cells from the fixation point (doc 09 §3.2 "within 2 cells of fixation").
// Distance is counted in whole cells from the fixation lines: the four cells that touch the dot (rows 9–10,
// cols 9–10, 0-based) are distance 0, the ring around them distance 1, and so on, so the central zone is the
// 6 × 6 block rows 7–12 × cols 7–12 (36 cells).

export const AMSLER_N = 20;
export const AMSLER_CELL_MM = 5;
export const AMSLER_GRID_MM = AMSLER_N * AMSLER_CELL_MM; // 100 mm
export const AMSLER_CELLS = AMSLER_N * AMSLER_N; // 400
export const CENTRAL_MAX_DISTANCE = 2;

export const AMSLER_KINDS = ['wavy', 'blurred', 'missing'] as const;
export type AmslerKind = (typeof AMSLER_KINDS)[number];

/** One entry per cell (length 400): the brush that marked it, or null. A cell carries one kind (last brush wins). */
export type AmslerCells = readonly (AmslerKind | null)[];

export function emptyCells(): AmslerCells {
  return new Array<AmslerKind | null>(AMSLER_CELLS).fill(null);
}

export const cellIndex = (row: number, col: number): number => row * AMSLER_N + col;
export const cellRowCol = (i: number): { row: number; col: number } => ({ row: Math.floor(i / AMSLER_N), col: i % AMSLER_N });

/** Grid edge in CSS px for a screen scale (CSS px per mm). */
export function amslerGridPx(pxPerMm: number): number {
  return AMSLER_GRID_MM * pxPerMm;
}

/** Cell under a point measured from the grid's top-left corner, or null outside the grid. */
export function cellAtPoint(x: number, y: number, gridPx: number): number | null {
  if (!(gridPx > 0) || x < 0 || y < 0 || x >= gridPx || y >= gridPx) return null;
  const col = Math.min(AMSLER_N - 1, Math.floor((x / gridPx) * AMSLER_N));
  const row = Math.min(AMSLER_N - 1, Math.floor((y / gridPx) * AMSLER_N));
  return cellIndex(row, col);
}

const half = AMSLER_N / 2; // 10: the fixation lines lie between index 9 and 10
const axisDistance = (k: number): number => (k < half ? half - 1 - k : k - half);

/** Chebyshev distance (whole cells) of a cell from the fixation point; the 4 cells touching the dot are 0. */
export function fixationDistance(i: number): number {
  const { row, col } = cellRowCol(i);
  return Math.max(axisDistance(row), axisDistance(col));
}

export function isCentral(i: number): boolean {
  return fixationDistance(i) <= CENTRAL_MAX_DISTANCE;
}

export function markedIndices(cells: AmslerCells): number[] {
  const out: number[] = [];
  cells.forEach((k, i) => {
    if (k !== null) out.push(i);
  });
  return out;
}

export function countMarked(cells: AmslerCells): number {
  return markedIndices(cells).length;
}

export function countCentral(indices: Iterable<number>): number {
  let n = 0;
  for (const i of indices) if (isCentral(i)) n += 1;
  return n;
}

/** Paint one cell with a brush (null = erase). Returns the same array when nothing changes. */
export function paintCell(cells: AmslerCells, i: number, kind: AmslerKind | null): AmslerCells {
  if (i < 0 || i >= AMSLER_CELLS || cells[i] === kind) return cells;
  const next = cells.slice();
  next[i] = kind;
  return next;
}

// --- Bitmasks: 400 bits per kind → 50 bytes → 100 hex characters (bit i = cell i, LSB first in each byte).

export type AmslerMasks = Record<AmslerKind, string>;

export function encodeMask(indices: Iterable<number>): string {
  const bytes = new Uint8Array(AMSLER_CELLS / 8);
  for (const i of indices) {
    if (!Number.isInteger(i) || i < 0 || i >= AMSLER_CELLS) throw new RangeError(`cell ${i} outside the grid`);
    bytes[i >> 3] = (bytes[i >> 3] as number) | (1 << (i & 7));
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function decodeMask(hex: string): number[] {
  if (!/^[0-9a-f]{100}$/.test(hex)) throw new RangeError('mask must be 100 lowercase hex characters');
  const out: number[] = [];
  for (let byte = 0; byte < AMSLER_CELLS / 8; byte += 1) {
    const b = parseInt(hex.slice(byte * 2, byte * 2 + 2), 16);
    for (let bit = 0; bit < 8; bit += 1) if (b & (1 << bit)) out.push(byte * 8 + bit);
  }
  return out;
}

export function cellsToMasks(cells: AmslerCells): AmslerMasks {
  const pick = (kind: AmslerKind) => markedIndices(cells).filter((i) => cells[i] === kind);
  return { wavy: encodeMask(pick('wavy')), blurred: encodeMask(pick('blurred')), missing: encodeMask(pick('missing')) };
}

/** Masks → cells. A cell set in more than one mask keeps the last kind in AMSLER_KINDS order. */
export function masksToCells(masks: AmslerMasks): AmslerCells {
  const cells = emptyCells().slice();
  for (const kind of AMSLER_KINDS) for (const i of decodeMask(masks[kind])) cells[i] = kind;
  return cells;
}

// --- Diff vs the previous test of the same eye.

/**
 * What is known about the previous test of this eye:
 * - 'map': a stored bitmask (exact positions);
 * - 'empty': a previous count of 0 cells without a map — an empty map, exact;
 * - 'count-only': a previous count > 0 without a stored map (positions unknown; e.g. simulated history);
 * - 'none': no earlier test of this eye on record.
 */
export type PreviousMap =
  | { kind: 'map'; missionDay: number; marked: readonly number[] }
  | { kind: 'empty'; missionDay: number }
  | { kind: 'count-only'; missionDay: number; count: number; centralCount: number | null }
  | { kind: 'none' };

export interface AmslerDiff {
  count: number;
  centralCount: number;
  /** Cells known to be new (highlighted). Empty for 'count-only', where positions are unknown. */
  newIndices: number[];
  newCells: number;
  newCentralCells: number;
  /** false when the previous positions were unknown and the new count is estimated from counts. */
  exact: boolean;
}

export function diffAmsler(cells: AmslerCells, prev: PreviousMap): AmslerDiff {
  const marked = markedIndices(cells);
  const count = marked.length;
  const centralCount = countCentral(marked);
  if (prev.kind === 'count-only') {
    // Positions unknown: every cell beyond the previous count counts as new; central cells beyond the previous
    // central count (0 when unknown — the cautious reading) count as new central cells.
    const newCentralCells = Math.max(0, centralCount - (prev.centralCount ?? 0));
    const newCells = Math.max(count - prev.count, newCentralCells, 0);
    return { count, centralCount, newIndices: [], newCells, newCentralCells, exact: false };
  }
  // 'none' (first test) and 'empty' compare with an empty map: every marked cell is new.
  const before = new Set(prev.kind === 'map' ? prev.marked : []);
  const newIndices = marked.filter((i) => !before.has(i));
  return { count, centralCount, newIndices, newCells: newIndices.length, newCentralCells: countCentral(newIndices), exact: true };
}
