// Amsler flow (doc 09 §3.2): viewing distance → right eye → left eye → result → Save → verdict.
import { useState } from 'react';
import type { ReactNode } from 'react';

import { AMSLER_DISTANCE_MM, VISION_DEMO_SOURCE_IDS, diffAmsler, type AmslerCells } from '../../../measurement/vision';
import { usePreviousAmslerMap } from '../../../services/hooks';
import { Value } from '../../../ui';
import { AmslerResult, type AmslerEyeResult, type SaveState } from './AmslerResult';
import { AmslerTest } from './AmslerTest';
import { DistanceStep } from './bits';
import { EYES, type DistanceMethod, type Eye } from './observations';
import type { VisionTestMode } from './testMode';

export interface AmslerFlowProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  pxPerMm: number;
  testMode: VisionTestMode | null;
  onSave: (results: readonly AmslerEyeResult[], distance: DistanceMethod) => Promise<readonly string[]>;
  onExit: () => void;
  /** Optional camera distance check (rendered inside the distance step). */
  renderCamera?: (targetMm: number, onReady: () => void) => ReactNode;
}

type Phase = { k: 'distance' } | { k: 'eye'; index: number } | { k: 'result' };

export function AmslerFlow({ crewId, crewName, missionDay, pxPerMm, testMode, onSave, onExit, renderCamera }: AmslerFlowProps) {
  const [phase, setPhase] = useState<Phase>({ k: 'distance' });
  const [distance, setDistance] = useState<DistanceMethod>('ruler');
  const [marked, setMarked] = useState<Partial<Record<Eye, AmslerCells | null>>>({});
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const prevRight = usePreviousAmslerMap(crewId, 'right', missionDay);
  const prevLeft = usePreviousAmslerMap(crewId, 'left', missionDay);
  const prevOf = (e: Eye) => (e === 'right' ? prevRight : prevLeft);

  const finishEye = (eye: Eye, cells: AmslerCells | null) => {
    setMarked((m) => ({ ...m, [eye]: cells }));
    const next = EYES.indexOf(eye) + 1;
    setPhase(next < EYES.length ? { k: 'eye', index: next } : { k: 'result' });
  };
  const retake = () => {
    setMarked({});
    setSave({ kind: 'idle' });
    setPhase({ k: 'eye', index: 0 });
  };

  const results: AmslerEyeResult[] = [];
  for (const eye of EYES) {
    const cells = marked[eye];
    const prev = prevOf(eye);
    if (cells && prev) results.push({ eye, cells, prev, diff: diffAmsler(cells, prev) });
  }
  const doSave = async () => {
    setSave({ kind: 'saving' });
    try {
      setSave({ kind: 'saved', ids: await onSave(results, distance) });
    } catch (e) {
      setSave({ kind: 'error', message: e instanceof Error ? e.message : 'The record could not be saved.' });
    }
  };

  if (phase.k === 'distance') {
    const go = (m: DistanceMethod) => {
      setDistance(m);
      setPhase({ k: 'eye', index: 0 });
    };
    return (
      <DistanceStep
        distance={<Value value={AMSLER_DISTANCE_MM.max / 10} prefix={`${AMSLER_DISTANCE_MM.min / 10}–`} unit="cm" sourceIds={VISION_DEMO_SOURCE_IDS} size="sm" title="Amsler viewing distance" />}
        onRuler={() => go('ruler')}
        camera={renderCamera?.(AMSLER_DISTANCE_MM.target, () => go('camera'))}
      />
    );
  }
  if (phase.k === 'eye') {
    const eye = EYES[phase.index] as Eye;
    return <AmslerTest key={eye} eye={eye} pxPerMm={pxPerMm} testMode={testMode} onDone={(c) => finishEye(eye, c)} onSkip={() => finishEye(eye, null)} />;
  }
  if (prevRight === undefined || prevLeft === undefined) return <p className="text-sm text-text-2">Loading the previous maps…</p>;
  return (
    <AmslerResult
      crewId={crewId}
      crewName={crewName}
      missionDay={missionDay}
      pxPerMm={pxPerMm}
      results={results}
      testMode={testMode !== null}
      save={save}
      onSave={() => void doSave()}
      onRetake={retake}
      onExit={onExit}
    />
  );
}
