import { describe, expect, it } from 'vitest';

import { SIGNALS } from '../../../domain/signals';
import { assessSignal } from '../../../domain/verdict/assess';
import type { LayerResult, Observation, RuleCtx } from '../../../domain/types';
import { cellIndex, createAcuityTest, diffAmsler, emptyCells, paintCell, scoreAcuity } from '../../../measurement/vision';
import { validateNewObservation } from '../../../services/validation';
import { buildAcuityObservation, buildAmslerObservation, DISTANCE_NOT_MEASURED, visionQuality } from './observations';

const twoPeripheral = paintCell(paintCell(emptyCells(), cellIndex(0, 0), 'wavy'), cellIndex(0, 1), 'blurred');

describe('vision observations', () => {
  it('amsler: count, diff components, map attachment, MEASURED manual source; passes the validator', () => {
    const diff = diffAmsler(twoPeripheral, { kind: 'empty', missionDay: 120 });
    const o = buildAmslerObservation({ crewId: 'c3', missionDay: 143, eye: 'right', diff, mapId: 'm1', distance: 'ruler', testMode: false });
    expect(o).toMatchObject({
      signalId: 'amsler',
      value: 2,
      unit: '{areas}',
      components: { newCells: 2, newCentralCells: 0, centralCells: 0, peripheralCells: 2 },
      context: { eye: 'right' },
      attachments: [{ kind: 'amsler-map', ref: 'm1' }],
      source: { kind: 'manual', method: 'Amsler grid (on-screen)', label: 'MEASURED' },
      quality: { label: 'fair', reasons: [DISTANCE_NOT_MEASURED] },
    });
    expect(() => validateNewObservation(o)).not.toThrow();
  });

  it('test mode is SIMULATED; camera distance is good quality', () => {
    const diff = diffAmsler(emptyCells(), { kind: 'none' });
    const o = buildAmslerObservation({ crewId: 'c3', missionDay: 143, eye: 'left', diff, mapId: 'm2', distance: 'camera', testMode: true });
    expect(o.source).toEqual({ kind: 'simulated', method: 'Amsler grid (on-screen); scripted test mode', label: 'SIMULATED' });
    expect(o.quality).toEqual({ score: 1, label: 'good', reasons: [] });
    expect(visionQuality('ruler').label).toBe('fair');
  });

  it('domain rules: 2 new peripheral cells → WATCH (+ vision-change protocol); a new central cell → ACT', () => {
    const ctxFor = (o: Observation): RuleCtx =>
      ({ missionDay: 143, history: [o], preflight: { median: null, n: 0 }, sameDay: {} }) as unknown as RuleCtx;
    const asObs = (n: ReturnType<typeof buildAmslerObservation>): Observation =>
      ({ ...n, id: 'x', missionDay: 143, effectiveAt: '2026-11-14T00:00:00Z' }) as Observation;
    const peripheral = asObs(
      buildAmslerObservation({ crewId: 'c3', missionDay: 143, eye: 'right', diff: diffAmsler(twoPeripheral, { kind: 'empty', missionDay: 120 }), mapId: 'm', distance: 'ruler', testMode: false }),
    );
    const none: LayerResult = { verdict: 'NO_DATA', layer: 'personal', reason: '', sourceIds: [] };
    const w = assessSignal(SIGNALS.amsler, [peripheral], ctxFor(peripheral), { ...none });
    expect(w.verdict).toBe('WATCH');
    expect(w.action).toMatchObject({ kind: 'protocol', protocolId: 'vision-change' });
    const central = asObs(
      buildAmslerObservation({ crewId: 'c3', missionDay: 143, eye: 'right', diff: diffAmsler(paintCell(emptyCells(), cellIndex(10, 10), 'missing'), { kind: 'empty', missionDay: 120 }), mapId: 'm', distance: 'ruler', testMode: false }),
    );
    expect(assessSignal(SIGNALS.amsler, [central], ctxFor(central), { ...none }).verdict).toBe('ACT');
  });

  it('near acuity: logMAR value, eye + glasses context, seed in the method, resolution limit → fair', () => {
    const s = createAcuityTest(1, 0); // nothing drawable
    expect(buildAcuityObservation({ crewId: 'c3', missionDay: 143, eye: 'right', score: scoreAcuity(s), withGlasses: false, seed: 1, distance: 'ruler', testMode: false }).ok).toBe(false);
    const score = { logMAR: 0.2, lastPassed: 0.2, extraCorrect: 0, resolutionLimited: true, limitLogMAR: 0.2, correctTotal: 45, answeredTotal: 45 };
    const r = buildAcuityObservation({ crewId: 'c3', missionDay: 143, eye: 'left', score, withGlasses: true, seed: 42, distance: 'ruler', testMode: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.observation).toMatchObject({
      signalId: 'near_acuity',
      value: 0.2,
      unit: '{logMAR}',
      context: { eye: 'left', withGlasses: true },
      components: { resolutionLimited: 1 },
      source: { method: 'Tumbling E (on-screen); seed 42', label: 'MEASURED' },
      quality: { label: 'fair', reasons: [DISTANCE_NOT_MEASURED, 'screen resolution limit reached at logMAR 0.2'] },
    });
    expect(() => validateNewObservation(r.observation)).not.toThrow();
  });
});
