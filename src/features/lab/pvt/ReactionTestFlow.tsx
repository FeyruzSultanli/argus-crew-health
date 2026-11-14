// Reaction Self-Test (PVT-B style) flow — FR-LAB-3, docs/09_MEASUREMENT_LAB.md §4.
// how-to → full-screen focus mode → result → Save. No store or Dexie access: subject, mission day and the save
// function come in as props (Part 2 wires them to ui.selectedCrewId / mission.missionDay / healthService).
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { NewObservation } from '../../../domain/types';
import { scorePvt } from '../../../measurement/pvt';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { SubjectChip } from '../SubjectChip';
import { TestModeBadge } from './bits';
import { FocusView } from './FocusView';
import { buildReactionObservation } from './observation';
import { PvtIntro } from './PvtIntro';
import { PvtResult, type SaveState } from './PvtResult';
import { type PvtTestMode, testModeFromSearch } from './testMode';
import { usePvtSession } from './usePvtSession';

export interface ReactionTestFlowProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  onSave: (o: NewObservation) => Promise<unknown>;
  onExit?: () => void;
  /** First-ever run of this user → labeled "practice" (doc 09 §4). Part 2 derives it from the record. */
  isPractice?: boolean;
  /** Scripted test mode; undefined → read ?pvtTest=1&pvtProfile=… from the URL, null → off. */
  testMode?: PvtTestMode | null;
  /** Comparison block under the result (route wrapper: personal band, lapses vs baseline, sleep, verdict). */
  renderEvaluation?: (ctx: { saved: boolean }) => ReactNode;
}

function urlTestMode(): PvtTestMode | null {
  return typeof window === 'undefined' ? null : testModeFromSearch(window.location.search);
}

export function ReactionTestFlow({ crewId, crewName, missionDay, onSave, onExit, isPractice = false, testMode, renderEvaluation }: ReactionTestFlowProps) {
  const mode = useMemo(() => (testMode === undefined ? urlTestMode() : testMode), [testMode]);
  const session = usePvtSession(mode);
  const [started, setStarted] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  // Practice is decided when the run starts: saving it must not flip the label on the result screen.
  const [practiceRun, setPracticeRun] = useState(false);
  const { snapshot } = session;

  const score = useMemo(() => (snapshot?.phase === 'done' ? scorePvt(snapshot.responses) : null), [snapshot]);
  const built = useMemo(
    () => (score && snapshot ? buildReactionObservation(score, { crewId, missionDay, seed: snapshot.seed, testMode: mode }) : null),
    [score, snapshot, crewId, missionDay, mode],
  );

  const begin = () => {
    setSave({ kind: 'idle' });
    setPracticeRun(isPractice);
    setStarted(true);
    session.start();
  };
  const exit = () => {
    session.stop();
    onExit?.();
  };
  const doSave = async () => {
    if (!built?.ok) return;
    setSave({ kind: 'saving' });
    try {
      await onSave(built.observation);
      setSave({ kind: 'saved' });
    } catch (e) {
      setSave({ kind: 'error', message: e instanceof Error ? e.message : 'The record could not be saved.' });
    }
  };

  const phase = started ? snapshot?.phase : undefined;
  const inFocus = phase === 'isi' || phase === 'stimulus' || phase === 'paused';
  return (
    <section aria-labelledby="pvt-title" className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="pvt-title" className="text-2xl font-semibold">
            Reaction Self-Test
          </h1>
          <SubjectChip name={crewName} />
          {mode && <TestModeBadge profile={mode.profile} />}
        </div>
      </header>

      {!started && <PvtIntro isPractice={isPractice} testMode={mode} onStart={begin} onExit={onExit ? exit : undefined} />}
      {inFocus && snapshot && (
        <FocusView
          snapshot={snapshot}
          now={session.now}
          crewName={crewName}
          testProfile={mode?.profile ?? null}
          onRespond={session.respond}
          onClickRespond={session.respondFromClick}
          onStimulusRendered={session.notifyStimulusRendered}
          onStop={session.stop}
        />
      )}
      {phase === 'done' && score && snapshot && (
        <PvtResult
          score={score}
          seed={snapshot.seed}
          crewName={crewName}
          missionDay={missionDay}
          isPractice={practiceRun}
          testMode={mode}
          evaluation={renderEvaluation?.({ saved: save.kind === 'saved' })}
          blockedReason={built && !built.ok ? built.reason : null}
          save={save}
          onSave={() => void doSave()}
          onRetake={begin}
          onExit={onExit ? exit : undefined}
        />
      )}
      {phase === 'aborted' && snapshot && (
        <Card tone="watch" title="Test stopped" headingLevel={2}>
          <p role="status" aria-live="polite" className="text-text-2">
            {snapshot.abortReason === 'focus-lost'
              ? 'The window lost focus for too long, so the test stopped. Nothing was saved.'
              : 'You stopped the test. Nothing was saved.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" onClick={begin}>
              Start again
            </Button>
            {onExit && <Button onClick={exit}>Done</Button>}
          </div>
        </Card>
      )}
    </section>
  );
}
