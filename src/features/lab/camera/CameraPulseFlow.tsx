// Camera pulse (rPPG) flow — FR-LAB-2, docs/09_MEASUREMENT_LAB.md §1, doc 11 §5.4.
// explainer → how-to → live capture → result → Save. No store or Dexie access here: the subject, mission day and
// the save function come in as props (CameraPulseRoute wires them to the stores and healthService).
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { NewObservation } from '../../../domain/types';
import { SubjectChip } from './bits';
import { type CameraPulseDeps, defaultCameraPulseDeps } from './deps';
import { ErrorView } from './ErrorView';
import { HowToCard, PermissionExplainer } from './IntroSteps';
import { LiveView } from './LiveView';
import { toObservation } from './observation';
import { ResultView, type SaveState } from './ResultView';
import { useCameraPulse } from './useCameraPulse';

export interface CameraPulseFlowProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  onSave: (o: NewObservation) => Promise<unknown>;
  /** "Not now", "Done", "Discard and exit". The focused-flow bar has its own Exit. */
  onExit?: () => void;
  usual?: { lo: number; hi: number };
  /** Domain verdict block for the result, given whether the reading has been saved. */
  renderEvaluation?: (s: { saved: boolean }) => ReactNode;
  /** Next to the subject chip, e.g. the CMO's "Change" button. */
  subjectAction?: ReactNode;
  /** Show the ?debug=rppg overlay; defaults to reading the URL. */
  debug?: boolean;
  /** Test seam: fake camera / landmarker / engine. */
  deps?: Partial<CameraPulseDeps>;
}

function debugFromUrl(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'rppg';
}

type Step = 'explainer' | 'howto' | 'session';

export function CameraPulseFlow({
  crewId,
  crewName,
  missionDay,
  onSave,
  onExit,
  usual,
  renderEvaluation,
  subjectAction,
  debug,
  deps,
}: CameraPulseFlowProps) {
  const allDeps = useMemo(() => ({ ...defaultCameraPulseDeps, ...deps }), [deps]);
  const isDebug = debug ?? debugFromUrl();
  const [mirrored, setMirrored] = useState(true);
  const opts = useMemo(() => ({ debug: isDebug, mirrored }), [isDebug, mirrored]);
  const session = useCameraPulse(allDeps, opts);
  const [step, setStep] = useState<Step>('explainer');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  const begin = () => {
    setSave({ kind: 'idle' });
    setStep('session');
    void session.start();
  };
  const exit = () => {
    session.stop();
    onExit?.();
  };
  const doSave = async (asPoor: boolean) => {
    if (!session.result || session.result.bpm === null) return;
    setSave({ kind: 'saving' });
    try {
      await onSave(toObservation(session.result, crewId, missionDay));
      setSave({ kind: 'saved', poor: asPoor });
    } catch (e) {
      setSave({ kind: 'error', message: e instanceof Error ? e.message : 'The record could not be saved.' });
    }
  };

  const { phase } = session;
  return (
    <section aria-labelledby="cp-title" className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 id="cp-title" className="text-2xl font-semibold">
          Camera pulse
        </h1>
        <SubjectChip name={crewName} />
        {subjectAction}
      </header>

      {step === 'explainer' && <PermissionExplainer onContinue={() => setStep('howto')} onExit={onExit ? exit : undefined} />}
      {step === 'howto' && <HowToCard onStart={begin} onBack={() => setStep('explainer')} />}
      {step === 'session' && (phase === 'starting' || phase === 'live') && (
        <LiveView
          phase={phase}
          live={session.live}
          videoRef={session.videoRef}
          overlayRef={session.overlayRef}
          debug={isDebug}
          mirrored={mirrored}
          onToggleMirror={() => setMirrored((m) => !m)}
          onCancel={() => {
            session.stop();
            setStep('howto');
          }}
        />
      )}
      {step === 'session' && phase === 'done' && session.result && (
        <ResultView
          result={session.result}
          crewName={crewName}
          usual={usual}
          evaluation={renderEvaluation?.({ saved: save.kind === 'saved' })}
          save={save}
          onSave={(asPoor) => void doSave(asPoor)}
          onRetake={begin}
          onExit={onExit ? exit : undefined}
        />
      )}
      {step === 'session' && phase === 'error' && session.error && (
        <ErrorView error={session.error} onRetry={begin} onExit={onExit ? exit : undefined} />
      )}
    </section>
  );
}
