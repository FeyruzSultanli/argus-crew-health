// combine() — every branch of doc 07 §3 (doc 14 §2).
import { describe, expect, it } from 'vitest';

import { FAIR, GOOD, POOR, layer } from '../__tests__/fixtures';
import type { SignalDef, Verdict } from '../types';
import { GENERIC_ACTIONS, QUALITY_GATE_ACTION, actionFor } from './actions';
import { combine, isCaughtOnlyByPersonal } from './combine';
import {
  ADAPTATION_EXPLANATION,
  CAUGHT_ONLY_BY_PERSONAL_NOTE,
  EARTH_ACT_SOFTENED_EXPLANATION,
  FAIR_PERSONAL_ACT_NOTE,
  POOR_QUALITY_NOTE,
  VERDICT_MEANING,
} from './explain';

const DEF: Pick<SignalDef, 'actions' | 'label'> = { label: 'Test signal', actions: {} };
const HR_LIKE: Pick<SignalDef, 'actions' | 'label'> = {
  label: 'HR',
  actions: { WATCH: { text: 'Specific watch.', kind: 'remeasure' } },
};

const run = (p: Verdict, s: Verdict, e: Verdict, q = GOOD, def = DEF) =>
  combine(layer('personal', p), layer('space', s), layer('earth', e), q, def);

describe('steps 1–2: NO_DATA layers are ignored', () => {
  it('all NO_DATA → NO_DATA with the generic NO_DATA action', () => {
    const r = run('NO_DATA', 'NO_DATA', 'NO_DATA');
    expect(r.verdict).toBe('NO_DATA');
    expect(r.rule).toBe('no-data');
    expect(r.drivenBy).toEqual([]);
    expect(r.caughtOnlyByPersonal).toBe(false);
    expect(r.action).toEqual({ text: 'Measure to update.', kind: 'remeasure' });
    expect(r.explanation).toBe(VERDICT_MEANING.NO_DATA);
  });
  it('all NO_DATA ignores even a poor quality label', () => {
    expect(run('NO_DATA', 'NO_DATA', 'NO_DATA', POOR).qualityGate).toBe('none');
  });
  it.each(['NOMINAL', 'EXPECTED', 'WATCH', 'ACT'] as Verdict[])('single layer %s decides alone', (v) => {
    expect(run(v, 'NO_DATA', 'NO_DATA').verdict).toBe(v);
    expect(run(v, 'NO_DATA', 'NO_DATA').drivenBy).toEqual(['personal']);
    expect(run('NO_DATA', v, 'NO_DATA').drivenBy).toEqual(['space']);
    expect(run('NO_DATA', 'NO_DATA', v).drivenBy).toEqual(['earth']);
  });
});

describe('step 4: adaptation downgrade', () => {
  it.each(['NOMINAL', 'EXPECTED', 'NO_DATA'] as Verdict[])(
    'earth WATCH + space EXPECTED + personal %s → EXPECTED, drivenBy [space]',
    (p) => {
      const r = run(p, 'EXPECTED', 'WATCH');
      expect(r.verdict).toBe('EXPECTED');
      expect(r.drivenBy).toEqual(['space']);
      expect(r.rule).toBe('adaptation-downgrade');
      expect(r.explanation).toBe(ADAPTATION_EXPLANATION);
      expect(r.action).toEqual(actionFor(DEF, 'EXPECTED'));
    },
  );
  it.each(['NOMINAL', 'EXPECTED', 'NO_DATA'] as Verdict[])(
    'earth ACT + space EXPECTED + personal %s → WATCH (softened one level only)',
    (p) => {
      const r = run(p, 'EXPECTED', 'ACT');
      expect(r.verdict).toBe('WATCH');
      expect(r.drivenBy).toEqual(['earth', 'space']);
      expect(r.rule).toBe('earth-act-softened');
      expect(r.explanation).toBe(EARTH_ACT_SOFTENED_EXPLANATION);
    },
  );
  it.each(['WATCH', 'ACT'] as Verdict[])('no downgrade when personal is %s', (p) => {
    const watch = run(p, 'EXPECTED', 'WATCH');
    expect(watch.rule).toBe('max-severity');
    expect(watch.verdict).toBe(p);
    const act = run(p, 'EXPECTED', 'ACT');
    expect(act.verdict).toBe('ACT');
  });
  it('no downgrade when space is not EXPECTED', () => {
    expect(run('NOMINAL', 'NOMINAL', 'WATCH').verdict).toBe('WATCH');
    expect(run('NOMINAL', 'NO_DATA', 'ACT').verdict).toBe('ACT');
    expect(run('NOMINAL', 'WATCH', 'WATCH').drivenBy).toEqual(['space', 'earth']);
  });
});

describe('step 5: max severity', () => {
  it('drivenBy lists every layer at the top severity, in personal/space/earth order', () => {
    const r = run('WATCH', 'WATCH', 'WATCH');
    expect(r.verdict).toBe('WATCH');
    expect(r.drivenBy).toEqual(['personal', 'space', 'earth']);
    expect(r.explanation).toBe(
      'Flagged by the personal baseline, space rule and Earth reference. Personal baseline: personal WATCH.',
    );
  });
  it('ACT beats WATCH; EXPECTED beats NOMINAL', () => {
    expect(run('WATCH', 'ACT', 'NOMINAL').drivenBy).toEqual(['space']);
    expect(run('NOMINAL', 'EXPECTED', 'NOMINAL').verdict).toBe('EXPECTED');
    expect(run('NOMINAL', 'NOMINAL', 'NOMINAL').drivenBy).toEqual(['personal', 'space', 'earth']);
  });
  it('nominal explanation uses the lead layer reason', () => {
    const r = combine(
      { layer: 'personal', verdict: 'NO_DATA', reason: '', sourceIds: [] },
      { layer: 'space', verdict: 'NOMINAL', reason: '70 bpm is within 50–100 bpm', sourceIds: [] },
      { layer: 'earth', verdict: 'NOMINAL', reason: 'x.', sourceIds: [] },
      GOOD,
      DEF,
    );
    expect(r.explanation).toBe('Space rule: 70 bpm is within 50–100 bpm.');
  });
  it('signal-specific action is used when present, generic otherwise', () => {
    expect(run('NOMINAL', 'WATCH', 'NOMINAL', GOOD, HR_LIKE).action.text).toBe('Specific watch.');
    expect(run('NOMINAL', 'ACT', 'NOMINAL', GOOD, HR_LIKE).action).toEqual({
      text: GENERIC_ACTIONS.ACT.text,
      kind: 'tell-cmo',
    });
    expect(run('NOMINAL', 'NOMINAL', 'NOMINAL').action.kind).toBe('none');
  });
});

describe('step 6: quality gate', () => {
  it('poor caps ACT at WATCH and forces the re-measure action (step 6 wins over step 8)', () => {
    const r = run('NOMINAL', 'ACT', 'ACT', POOR, HR_LIKE);
    expect(r.verdict).toBe('WATCH');
    expect(r.preGateVerdict).toBe('ACT');
    expect(r.qualityGate).toBe('poor-cap');
    expect(r.action).toEqual({ text: QUALITY_GATE_ACTION.text, kind: 'remeasure' });
    expect(r.explanation).toContain(POOR_QUALITY_NOTE);
  });
  it('poor keeps lower verdicts but still asks to re-measure', () => {
    const n = run('NOMINAL', 'NOMINAL', 'NOMINAL', POOR);
    expect(n.verdict).toBe('NOMINAL');
    expect(n.action.text).toBe('Reading quality is poor. Re-measure.');
    expect(run('NOMINAL', 'EXPECTED', 'WATCH', POOR).verdict).toBe('EXPECTED');
    expect(run('WATCH', 'NOMINAL', 'NOMINAL', POOR).verdict).toBe('WATCH');
  });
  it('fair + ACT driven only by personal → WATCH with the WATCH action', () => {
    const r = run('ACT', 'NOMINAL', 'NOMINAL', FAIR, HR_LIKE);
    expect(r.verdict).toBe('WATCH');
    expect(r.qualityGate).toBe('fair-personal-act');
    expect(r.action.text).toBe('Specific watch.');
    expect(r.explanation).toContain(FAIR_PERSONAL_ACT_NOTE);
  });
  it('fair does not soften an ACT that a rule layer shares', () => {
    const r = run('ACT', 'ACT', 'NOMINAL', FAIR);
    expect(r.verdict).toBe('ACT');
    expect(r.qualityGate).toBe('none');
    expect(run('NOMINAL', 'ACT', 'NOMINAL', FAIR).verdict).toBe('ACT');
    expect(run('WATCH', 'NOMINAL', 'NOMINAL', FAIR).verdict).toBe('WATCH');
  });
  it('good quality never gates', () => {
    expect(run('ACT', 'NOMINAL', 'NOMINAL', GOOD).verdict).toBe('ACT');
  });
});

describe('step 7: caughtOnlyByPersonal', () => {
  it.each([
    ['WATCH', 'NOMINAL', 'NOMINAL', true],
    ['ACT', 'NOMINAL', 'NOMINAL', true],
    ['ACT', 'EXPECTED', 'NO_DATA', true],
    ['WATCH', 'NO_DATA', 'NO_DATA', true],
    ['WATCH', 'WATCH', 'NOMINAL', false],
    ['ACT', 'NOMINAL', 'WATCH', false],
    ['EXPECTED', 'NOMINAL', 'NOMINAL', false],
    ['NO_DATA', 'NOMINAL', 'NOMINAL', false],
  ] as Array<[Verdict, Verdict, Verdict, boolean]>)(
    'personal %s, space %s, earth %s → %s',
    (p, s, e, expected) => {
      expect(isCaughtOnlyByPersonal(p, s, e)).toBe(expected);
      expect(run(p, s, e).caughtOnlyByPersonal).toBe(expected);
    },
  );
  it('the explanation says so', () => {
    const r = run('ACT', 'NOMINAL', 'NOMINAL');
    expect(r.drivenBy).toEqual(['personal']);
    expect(r.explanation).toBe(`Personal baseline: personal ACT. ${CAUGHT_ONLY_BY_PERSONAL_NOTE}`);
  });
  it('stays true when the fair gate softens the verdict', () => {
    expect(run('ACT', 'NOMINAL', 'NOMINAL', FAIR).caughtOnlyByPersonal).toBe(true);
  });
});

describe('actions', () => {
  it('generic templates are exactly doc 07 §3', () => {
    expect(GENERIC_ACTIONS.EXPECTED).toEqual({
      text: 'Known change in space. Keep doing your countermeasures.',
      kind: 'none',
    });
    expect(GENERIC_ACTIONS.WATCH).toEqual({
      text: 'Re-measure. If it is still outside your usual range, tell the CMO.',
      kind: 'remeasure',
    });
    expect(GENERIC_ACTIONS.ACT).toEqual({
      text: 'Tell the CMO now and send a report to the flight surgeon.',
      kind: 'tell-cmo',
    });
    expect(GENERIC_ACTIONS.NO_DATA).toEqual({ text: 'Measure to update.', kind: 'remeasure' });
    expect(QUALITY_GATE_ACTION).toEqual({ text: 'Reading quality is poor. Re-measure.', kind: 'remeasure' });
  });
  it('protocolId and dueInHours are carried over', () => {
    const def = {
      actions: {
        ACT: { text: 'x', kind: 'protocol' as const, protocolId: 'sleep-debt' as const, dueInHours: 2 },
      },
    };
    expect(actionFor(def, 'ACT')).toEqual({
      text: 'x',
      kind: 'protocol',
      protocolId: 'sleep-debt',
      dueInHours: 2,
    });
  });
});
