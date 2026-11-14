// Near-acuity flow (doc 09 §3.3): glasses? → viewing distance 60 cm → right eye → left eye → result → Save →
// verdict. One observation per eye with context.withGlasses; the orientation seed is stored in source.method.
import { Glasses, RotateCcw, Save } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { NewObservation } from '../../../domain/types';
import { ACUITY_DISTANCE_MM, VISION_DEMO_SOURCE_IDS, scoreAcuity, snellenDenominator, type AcuityState } from '../../../measurement/vision';
import { newSessionSeed } from '../pvt/testMode';
import { Badge, Button, Card, ErrorState, Value } from '../../../ui';
import type { DataLabel } from '../../../ui';
import { DistanceStep, VisionVerdict } from './bits';
import { AcuityTest } from './AcuityTest';
import type { SaveState } from './AmslerResult';
import { buildAcuityObservation, CALIBRATION_NOT_VERIFIED, EYES, eyeName, resolutionLimitText, type DistanceMethod, type Eye } from './observations';
import type { VisionTestMode } from './testMode';

export interface AcuityFlowProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  pxPerMm: number;
  testMode: VisionTestMode | null;
  onSave: (observations: readonly NewObservation[]) => Promise<readonly string[]>;
  onExit: () => void;
  renderCamera?: (targetMm: number, onReady: () => void) => ReactNode;
}

type Phase = { k: 'glasses' } | { k: 'distance' } | { k: 'eye'; index: number } | { k: 'result' };
const SRC = ['SRC_SANS_EYE_NATURE'] as const;
/** Each eye gets its own orientation sequence: right = session seed, left = seed + 1. */
const eyeSeed = (seed: number, eye: Eye): number => (eye === 'right' ? seed : (seed + 1) >>> 0);

export function AcuityFlow({ crewId, crewName, missionDay, pxPerMm, testMode, onSave, onExit, renderCamera }: AcuityFlowProps) {
  const [phase, setPhase] = useState<Phase>({ k: 'glasses' });
  const [withGlasses, setWithGlasses] = useState(false);
  const [distance, setDistance] = useState<DistanceMethod>('ruler');
  const [seed, setSeed] = useState(() => testMode?.seed ?? newSessionSeed());
  const [runs, setRuns] = useState<Partial<Record<Eye, AcuityState>>>({});
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  const finishEye = useCallback((eye: Eye, s: AcuityState) => {
    setRuns((r) => ({ ...r, [eye]: s }));
    const next = EYES.indexOf(eye) + 1;
    setPhase(next < EYES.length ? { k: 'eye', index: next } : { k: 'result' });
  }, []);

  const built = useMemo(
    () =>
      EYES.flatMap((eye) => {
        const s = runs[eye];
        if (!s) return [];
        const score = scoreAcuity(s);
        return [{ eye, score, res: buildAcuityObservation({ crewId, missionDay, eye, score, withGlasses, seed: eyeSeed(seed, eye), distance, testMode: testMode !== null }) }];
      }),
    [runs, crewId, missionDay, withGlasses, seed, distance, testMode],
  );
  const savable = built.flatMap((b) => (b.res.ok ? [b.res.observation] : []));
  const doSave = async () => {
    setSave({ kind: 'saving' });
    try {
      setSave({ kind: 'saved', ids: await onSave(savable) });
    } catch (e) {
      setSave({ kind: 'error', message: e instanceof Error ? e.message : 'The record could not be saved.' });
    }
  };
  const retake = () => {
    setRuns({});
    setSave({ kind: 'idle' });
    if (!testMode) setSeed(newSessionSeed());
    setPhase({ k: 'eye', index: 0 });
  };

  if (phase.k === 'glasses') {
    const pick = (g: boolean) => {
      setWithGlasses(g);
      setPhase({ k: 'distance' });
    };
    return (
      <Card title="Glasses" headingLevel={2}>
        <p className="mb-4 flex items-start gap-2 text-sm text-text-2">
          <Glasses aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          Are you wearing glasses for this test (for example Space Anticipation Glasses)?
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => pick(true)}>
            Yes, with glasses
          </Button>
          <Button onClick={() => pick(false)}>No glasses</Button>
        </div>
      </Card>
    );
  }
  if (phase.k === 'distance') {
    const go = (m: DistanceMethod) => {
      setDistance(m);
      setPhase({ k: 'eye', index: 0 });
    };
    return (
      <DistanceStep
        distance={<Value value={ACUITY_DISTANCE_MM / 10} unit="cm" sourceIds={VISION_DEMO_SOURCE_IDS} size="sm" title="Acuity viewing distance" />}
        onRuler={() => go('ruler')}
        camera={renderCamera?.(ACUITY_DISTANCE_MM, () => go('camera'))}
      >
        <p className="mt-2 text-sm text-text-2">This is an intermediate-distance screen test, not a 40-cm near card.</p>
      </DistanceStep>
    );
  }
  if (phase.k === 'eye') {
    const eye = EYES[phase.index] as Eye;
    return <AcuityTest key={eye} eye={eye} pxPerMm={pxPerMm} seed={eyeSeed(seed, eye)} scripted={testMode !== null} onDone={(s) => finishEye(eye, s)} />;
  }

  const label: DataLabel = testMode ? 'SIMULATED' : 'MEASURED';
  const saved = save.kind === 'saved';
  return (
    <section aria-labelledby="acuity-result" className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="acuity-result" className="text-xl font-semibold">
            Near acuity result
          </h2>
          {!testMode && <Badge tone="brand">MEASURED · this device</Badge>}
          <Badge tone="info">{withGlasses ? 'With glasses' : 'Without glasses'}</Badge>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {built.map(({ eye, score, res }) => (
            <div key={eye} className="rounded-control border border-border bg-surface-2 p-3" data-testid={`acuity-result-${eye}`}>
              <h3 className="text-sm text-text-2">{eyeName(eye)}</h3>
              <p className="mt-1" data-testid={`acuity-score-${eye}`} data-raw={score.logMAR ?? ''}>
                <Value value={score.logMAR} unit="{logMAR}" precision={2} size="lg" sourceIds={SRC} label={label} title={`${eyeName(eye)} near acuity`} />
              </p>
              {score.logMAR !== null && (
                <p className="mt-1 text-sm text-text-2">
                  Snellen equivalent ≈{' '}
                  <Value value={snellenDenominator(score.logMAR)} prefix="20/" precision={0} sourceIds={['SRC_EARTH_ACUITY']} size="sm" title="Snellen equivalent (approximate)" />{' '}
                  (approximate)
                </p>
              )}
              {score.resolutionLimited && score.limitLogMAR !== null && (
                <p className="mt-1 text-sm text-text" data-testid={`acuity-limit-${eye}`}>
                  The {resolutionLimitText(score.limitLogMAR)}; smaller lines cannot be drawn on this screen.
                </p>
              )}
              {!res.ok && <p className="mt-1 text-sm text-text">{res.reason}</p>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-text-3">{CALIBRATION_NOT_VERIFIED}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" icon={Save} disabled={save.kind === 'saving' || saved || savable.length === 0} onClick={() => void doSave()}>
            {save.kind === 'saving' ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Button>
          <Button icon={RotateCcw} onClick={retake}>
            Retake
          </Button>
          <Button onClick={onExit}>Done</Button>
        </div>
        <div aria-live="polite" className="mt-3 text-sm">
          {saved && (
            <p className="text-ok-fg">
              Saved for {crewName}, mission day {missionDay}
              {testMode ? ' — labeled SIMULATED (scripted test mode).' : '.'}
            </p>
          )}
        </div>
        {save.kind === 'error' && <ErrorState className="mt-3" title="Not saved" message={save.message} />}
      </Card>
      <Card title="Verdict" headingLevel={3}>
        <VisionVerdict crewId={crewId} missionDay={missionDay} signalId="near_acuity" savedIds={saved ? save.ids : null} />
      </Card>
    </section>
  );
}
