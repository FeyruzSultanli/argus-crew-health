import { describe, expect, it } from 'vitest';

import { pxPerMmFromCardWidth } from '../../features/settings/calibration';
import {
  ACUITY_LINES,
  AMSLER_CELLS,
  answerAcuity,
  amslerGridPx,
  cellAtPoint,
  cellIndex,
  cellsToMasks,
  countCentral,
  createAcuityTest,
  currentOrientation,
  decodeMask,
  diffAmsler,
  distanceFromIpdMm,
  distanceHint,
  drawableLineCount,
  E_DIRECTIONS,
  emptyCells,
  encodeMask,
  fixationDistance,
  focalLengthPx,
  ipdPixels,
  isCentral,
  masksToCells,
  optotypeHeightDevicePx,
  optotypeHeightMm,
  orientationSequence,
  paintCell,
  scoreAcuity,
  snellenDenominator,
  type AcuityState,
  type AmslerCells,
  type EDirection,
} from '.';

const mark = (pairs: Array<[number, number]>, kind: 'wavy' | 'blurred' | 'missing' = 'wavy'): AmslerCells =>
  pairs.reduce<AmslerCells>((c, [r, col]) => paintCell(c, cellIndex(r, col), kind), emptyCells());

describe('screen calibration → grid geometry', () => {
  it('ID-1 card width in px gives px/mm and the 100-mm grid', () => {
    const pxPerMm = pxPerMmFromCardWidth(324); // 324 px card ≈ 3.785 px/mm
    expect(pxPerMm).toBeCloseTo(3.785, 3);
    expect(amslerGridPx(pxPerMm)).toBeCloseTo(378.5, 1);
    expect(amslerGridPx(4)).toBe(400);
  });
  it('maps points to cells and rejects points outside', () => {
    expect(cellAtPoint(0, 0, 400)).toBe(0);
    expect(cellAtPoint(399.9, 399.9, 400)).toBe(399);
    expect(cellAtPoint(205, 195, 400)).toBe(cellIndex(9, 10));
    expect(cellAtPoint(400, 10, 400)).toBeNull();
    expect(cellAtPoint(-1, 10, 400)).toBeNull();
  });
});

describe('central rule (Chebyshev ≤ 2 cells from the fixation crossing)', () => {
  it('the four cells touching the dot are distance 0', () => {
    const zero = Array.from({ length: AMSLER_CELLS }, (_, i) => i).filter((i) => fixationDistance(i) === 0);
    expect(zero).toEqual([cellIndex(9, 9), cellIndex(9, 10), cellIndex(10, 9), cellIndex(10, 10)]);
  });
  it('the central zone is rows 7–12 × cols 7–12 (36 cells)', () => {
    const central = Array.from({ length: AMSLER_CELLS }, (_, i) => i).filter(isCentral);
    expect(central).toHaveLength(36);
    expect(isCentral(cellIndex(7, 7))).toBe(true);
    expect(isCentral(cellIndex(12, 12))).toBe(true);
    expect(isCentral(cellIndex(6, 10))).toBe(false);
    expect(isCentral(cellIndex(10, 13))).toBe(false);
    expect(fixationDistance(cellIndex(0, 0))).toBe(9);
    expect(fixationDistance(cellIndex(19, 19))).toBe(9);
  });
});

describe('bitmasks', () => {
  it('round-trips indices and cells', () => {
    const idx = [0, 7, 8, 199, 200, 399];
    const hex = encodeMask(idx);
    expect(hex).toMatch(/^[0-9a-f]{100}$/);
    expect(decodeMask(hex)).toEqual(idx);
    const cells = paintCell(paintCell(mark([[0, 0], [5, 5]]), cellIndex(19, 19), 'missing'), cellIndex(10, 10), 'blurred');
    const masks = cellsToMasks(cells);
    expect(decodeMask(masks.wavy)).toEqual([0, cellIndex(5, 5)]);
    expect(decodeMask(masks.blurred)).toEqual([cellIndex(10, 10)]);
    expect(decodeMask(masks.missing)).toEqual([399]);
    expect(masksToCells(masks)).toEqual(cells);
  });
  it('rejects malformed input', () => {
    expect(() => encodeMask([400])).toThrow(RangeError);
    expect(() => decodeMask('00')).toThrow(RangeError);
  });
  it('one kind per cell: last brush wins, erase clears', () => {
    let c = paintCell(emptyCells(), 3, 'wavy');
    c = paintCell(c, 3, 'missing');
    expect(c[3]).toBe('missing');
    expect(paintCell(c, 3, 'missing')).toBe(c);
    expect(paintCell(c, 3, null)[3]).toBeNull();
  });
});

describe('diff vs the previous map', () => {
  it('acceptance: 2 new peripheral cells vs an empty baseline', () => {
    const d = diffAmsler(mark([[0, 0], [0, 1]]), { kind: 'empty', missionDay: 60 });
    expect(d).toMatchObject({ count: 2, centralCount: 0, newCells: 2, newCentralCells: 0, exact: true });
    expect(d.newIndices).toEqual([0, 1]);
  });
  it('a central cell is a new central cell', () => {
    const d = diffAmsler(mark([[10, 10]]), { kind: 'empty', missionDay: 60 });
    expect(d).toMatchObject({ newCells: 1, newCentralCells: 1 });
  });
  it('unchanged cells of a stored map are not new', () => {
    const prev = { kind: 'map' as const, missionDay: 90, marked: [cellIndex(0, 0), cellIndex(0, 1)] };
    const d = diffAmsler(mark([[0, 0], [0, 1], [11, 8]]), prev);
    expect(d.newIndices).toEqual([cellIndex(11, 8)]);
    expect(d).toMatchObject({ count: 3, newCells: 1, newCentralCells: 1 });
    expect(diffAmsler(mark([[0, 0]]), prev)).toMatchObject({ count: 1, newCells: 0, newCentralCells: 0 });
  });
  it('count-only previous (positions unknown): cells beyond the previous count are new', () => {
    const prev = { kind: 'count-only' as const, missionDay: 90, count: 2, centralCount: 0 };
    expect(diffAmsler(mark([[0, 0], [0, 1]]), prev)).toMatchObject({ newCells: 0, newCentralCells: 0, exact: false, newIndices: [] });
    expect(diffAmsler(mark([[0, 0], [0, 1], [0, 2]]), prev)).toMatchObject({ newCells: 1, newCentralCells: 0 });
    // a central cell beyond the previous central count is new central even when the total did not grow
    expect(diffAmsler(mark([[9, 9]]), prev)).toMatchObject({ count: 1, newCells: 1, newCentralCells: 1 });
  });
  it('no previous test: everything marked is new', () => {
    expect(diffAmsler(mark([[3, 3]]), { kind: 'none' })).toMatchObject({ newCells: 1, exact: true });
    expect(countCentral([cellIndex(9, 9), 0])).toBe(1);
  });
});

describe('near acuity sizing at 60 cm', () => {
  it('matches h = d · tan(5·10^logMAR / 60 °) for every line', () => {
    const expected: Record<string, number> = {
      '1': 8.727, '0.9': 6.932, '0.8': 5.506, '0.7': 4.374, '0.6': 3.474, '0.5': 2.760,
      '0.4': 2.192, '0.3': 1.741, '0.2': 1.383, '0.1': 1.099, '0': 0.873,
    };
    for (const line of ACUITY_LINES) expect(optotypeHeightMm(line)).toBeCloseTo(expected[String(line)] as number, 2);
    expect(ACUITY_LINES).toHaveLength(11);
  });
  it('resolution limit: a 96-dpi screen (3.78 px/mm, dpr 1) draws down to logMAR 0.2', () => {
    const g = { distanceMm: 600, pxPerMm: 3.78, dpr: 1 };
    expect(optotypeHeightDevicePx(0.2, g)).toBeGreaterThanOrEqual(5);
    expect(optotypeHeightDevicePx(0.1, g)).toBeLessThan(5);
    expect(drawableLineCount(g)).toBe(9);
    expect(drawableLineCount({ ...g, dpr: 2 })).toBe(11);
  });
  it('Snellen equivalent by 20 · 10^logMAR', () => {
    expect(snellenDenominator(0.3)).toBe(40);
    expect(snellenDenominator(0)).toBe(20);
    expect(snellenDenominator(1)).toBe(200);
  });
});

/** Answer `correct` of the 5 optotypes of the current line right and the rest wrong. */
function answerLine(s: AcuityState, correct: number): AcuityState {
  let st = s;
  for (let k = 0; k < 5; k += 1) {
    const dir = currentOrientation(st) as EDirection;
    const wrong = E_DIRECTIONS.find((d) => d !== dir) as EDirection;
    st = answerAcuity(st, k < correct ? dir : wrong);
  }
  return st;
}

describe('near acuity scoring', () => {
  it('seeded orientations are reproducible', () => {
    expect(orientationSequence(7)).toEqual(orientationSequence(7));
    expect(orientationSequence(7)).toHaveLength(55);
    expect(orientationSequence(7)).not.toEqual(orientationSequence(8));
  });
  it('3/5 passes a line, 2/5 fails it and stops; −0.02 per extra letter', () => {
    let s = createAcuityTest(11, 11);
    for (let i = 0; i < 7; i += 1) s = answerLine(s, 5); // 1.0 … 0.4 passed
    s = answerLine(s, 3); // 0.3 passed with 3/5
    expect(s.done).toBe(false);
    s = answerLine(s, 2); // 0.2 failed with 2 correct
    expect(s.done).toBe(true);
    expect(s.stop).toBe('failed-line');
    expect(scoreAcuity(s)).toMatchObject({ logMAR: 0.26, lastPassed: 0.3, extraCorrect: 2, resolutionLimited: false });
  });
  it('a failed line with 0 correct scores the last passed line', () => {
    let s = createAcuityTest(3, 11);
    s = answerLine(s, 4);
    s = answerLine(s, 0);
    expect(scoreAcuity(s)).toMatchObject({ logMAR: 1.0, extraCorrect: 0 });
  });
  it('all lines passed → 0.0', () => {
    let s = createAcuityTest(5, 11);
    for (let i = 0; i < 11; i += 1) s = answerLine(s, 5);
    expect(s.stop).toBe('all-lines');
    expect(scoreAcuity(s).logMAR).toBe(0);
  });
  it('no line passed → no score', () => {
    const s = answerLine(createAcuityTest(5, 11), 2);
    expect(s.done).toBe(true);
    expect(scoreAcuity(s).logMAR).toBeNull();
  });
  it('resolution-limit stop after the last drawable line', () => {
    let s = createAcuityTest(9, 9); // 1.0 … 0.2 drawable
    for (let i = 0; i < 9; i += 1) s = answerLine(s, 5);
    expect(s.done).toBe(true);
    expect(s.stop).toBe('resolution-limit');
    expect(scoreAcuity(s)).toMatchObject({ logMAR: 0.2, resolutionLimited: true, limitLogMAR: 0.2 });
  });
  it('failing the last drawable line is a normal score, not a limit', () => {
    let s = createAcuityTest(9, 9);
    for (let i = 0; i < 8; i += 1) s = answerLine(s, 5);
    s = answerLine(s, 1);
    expect(scoreAcuity(s)).toMatchObject({ logMAR: 0.28, resolutionLimited: false });
  });
});

describe('viewing distance (pinhole, HFOV 65°, IPD 63 mm)', () => {
  it('focal length and distance', () => {
    const f = focalLengthPx(1280, 65);
    expect(f).toBeCloseTo(1004.6, 0);
    // at 60 cm the pupils are f · 63 / 600 ≈ 105.5 px apart
    expect(distanceFromIpdMm(105.48, f)).toBeCloseTo(600, 0);
    expect(distanceFromIpdMm(0, f)).toBeNull();
    expect(ipdPixels({ x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 }, 1280, 720)).toBeCloseTo(128, 6);
    expect(() => focalLengthPx(0, 65)).toThrow(RangeError);
  });
  it('±10 % hint', () => {
    expect(distanceHint(600, 600)).toBe('ok');
    expect(distanceHint(659, 600)).toBe('ok');
    expect(distanceHint(661, 600)).toBe('closer');
    expect(distanceHint(541, 600)).toBe('ok');
    expect(distanceHint(539, 600)).toBe('farther');
  });
});
