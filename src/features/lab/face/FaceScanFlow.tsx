// Face fluid-shift scan flow — FR-LAB-5, docs/09_MEASUREMENT_LAB.md §2 (experimental, P2, trend only).
// explainer → how-to → live 3-s capture → result → Save / Retake. No store or Dexie access: subject, mission day,
// the valid reference and the save function come in as props (FaceScanRoute wires them).
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { NewObservation } from '../../../domain/types';
import { type FluidIndex, REFERENCE_INDEX, fluidIndex } from '../../../measurement/face/fluidShiftIndex';
import { ErrorState, Button } from '../../../ui';
import { SubjectChip } from '../SubjectChip';
import { ERROR_TEXT, TITLE } from './copy';
import { type FaceScanDeps, defaultFaceScanDeps } from './deps';
import { ExperimentalBadge, FaceHowTo, FacePermissionExplainer } from './FaceIntro';
import { FaceLiveView } from './FaceLiveView';
import { type FaceSaveState, FaceResultView } from './FaceResultView';
import { toFaceObservation } from './observation';
import { ReferencePanel } from './ReferencePanel';
import type { FaceReference } from './referenceStore';
import { useFaceScan } from './useFaceScan';

export interface FaceScanFlowProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  /** The subject's valid reference on this device (null → the next accepted scan becomes the reference). */
  reference: FaceReference | null;
  onSave: (o: NewObservation) => Promise<{ id: string }>;
  onReferenceSet: (ref: FaceReference) => void;
  onResetReference: () => void;
  /** After Save: verdict + trend for the saved observation. */
  renderAfterSave?: (savedId: string) => ReactNode;
  onExit?: () => void;
  subjectAction?: ReactNode;
  /** ?debug=face overlay; defaults to reading the URL. */
  debug?: boolean;
  deps?: Partial<FaceScanDeps>;
}

function debugFromUrl(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'face';
}

type Step = 'explainer' | 'howto' | 'session';

export function FaceScanFlow(p: FaceScanFlowProps) {
  const { crewId, crewName, missionDay, reference, onExit } = p;
  const allDeps = useMemo(() => ({ ...defaultFaceScanDeps, ...p.deps }), [p.deps]);
  const isDebug = p.debug ?? debugFromUrl();
  const opts = useMemo(() => ({ debug: isDebug, mirrored: true }), [isDebug]);
  const scan = useFaceScan(allDeps, opts);
  const [step, setStep] = useState<Step>('explainer');
  const [save, setSave] = useState<FaceSaveState>({ kind: 'idle' });
  const [savedId, setSavedId] = useState<string | null>(null);
  // The reference in place when this scan started (saving the first scan sets one; the result must not flip).
  const [basis, setBasis] = useState<FaceReference | null>(null);

  const begin = () => {
    setSave({ kind: 'idle' });
    setSavedId(null);
    setBasis(reference);
    setStep('session');
    void scan.start();
  };
  const exit = () => {
    scan.stop();
    onExit?.();
  };
  const index: FluidIndex | null = scan.result?.features && basis ? fluidIndex(scan.result.features, basis.features) : null;

  const doSave = async (asPoor: boolean) => {
    const r = scan.result;
    if (!r?.features) return;
    setSave({ kind: 'saving' });
    try {
      const isReference = basis === null;
      const o = toFaceObservation({ crewId, missionDay, index: index ?? REFERENCE_INDEX, quality: r.quality, acceptedFrames: r.acceptedFrames, isReference });
      const saved = await p.onSave(o);
      if (isReference) {
        p.onReferenceSet({
          crewId,
          features: r.features,
          missionDay,
          quality: { label: r.quality.label, score: r.quality.score },
          observationId: saved.id,
          savedAt: new Date().toISOString(),
        });
      }
      setSavedId(saved.id);
      setSave({ kind: 'saved', poor: asPoor });
    } catch (e) {
      setSave({ kind: 'error', message: e instanceof Error ? e.message : 'The record could not be saved.' });
    }
  };

  const { phase } = scan;
  const err = scan.error ? (ERROR_TEXT[scan.error.kind] ?? (ERROR_TEXT.other as { title: string; body: string })) : null;
  return (
    <section aria-labelledby="fs-title" className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 id="fs-title" className="text-2xl font-semibold">
          {TITLE}
        </h1>
        <ExperimentalBadge />
        <SubjectChip name={crewName} />
        {p.subjectAction}
      </header>

      {step === 'explainer' && <FacePermissionExplainer onContinue={() => setStep('howto')} onExit={onExit ? exit : undefined} />}
      {step === 'howto' && (
        <FaceHowTo onStart={begin} onBack={() => setStep('explainer')}>
          <ReferencePanel reference={reference} onReset={p.onResetReference} />
        </FaceHowTo>
      )}
      {step === 'session' && (phase === 'starting' || phase === 'live') && (
        <FaceLiveView
          phase={phase}
          live={scan.live}
          videoRef={scan.videoRef}
          overlayRef={scan.overlayRef}
          debug={isDebug}
          mirrored={opts.mirrored}
          onCancel={() => {
            scan.stop();
            setStep('howto');
          }}
        />
      )}
      {step === 'session' && phase === 'done' && scan.result && (
        <FaceResultView
          result={scan.result}
          index={index}
          isReference={basis === null}
          crewName={crewName}
          save={save}
          onSave={(asPoor) => void doSave(asPoor)}
          onRetake={begin}
          onExit={onExit ? exit : undefined}
          afterSave={
            savedId && (
              <>
                {p.renderAfterSave?.(savedId)}
                <ReferencePanel reference={reference} onReset={p.onResetReference} />
              </>
            )
          }
        />
      )}
      {step === 'session' && phase === 'error' && scan.error && err && (
        <div className="flex flex-col gap-4">
          <ErrorState title={err.title} message={err.body} detail={scan.error.message} onRetry={begin} />
          {onExit && (
            <div>
              <Button onClick={exit}>Exit</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
