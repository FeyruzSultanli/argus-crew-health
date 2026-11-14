// Full-screen focus mode of the Reaction Self-Test (doc 11 §5.4: header collapses to a thin bar with Exit).
// Stimulus = counting millisecond timer in a red-bordered box (doc 09 §4). Big tap target ≥ 120 px.
// Deliberately plain markup: nothing heavy or animated sits in the timing path.
import { useEffect, useLayoutEffect, useRef } from 'react';

import type { PvtScriptProfile, PvtSnapshot } from '../../../measurement/pvt';
import { Button } from '../../../ui/Button';
import { SubjectChip } from '../SubjectChip';
import { TestModeBadge } from './bits';
import { formatClock } from './format';

/** How long the last response stays visible after a press (UI feedback only). */
const FEEDBACK_MS = 1000;

export interface FocusViewProps {
  snapshot: PvtSnapshot;
  now: number;
  crewName: string;
  testProfile: PvtScriptProfile | null;
  onRespond: () => void;
  onClickRespond: (detail: number) => void;
  onStimulusRendered: () => void;
  onStop: () => void;
}

function Feedback({ snapshot, now }: { snapshot: PvtSnapshot; now: number }) {
  const r = snapshot.lastResponse;
  if (!r || now - r.at > FEEDBACK_MS) return null;
  if (r.kind === 'false-start') return <span className="text-2xl font-semibold text-watch-fg">False start — wait for the box</span>;
  return (
    <span className="font-mono text-3xl text-text-2">
      {Math.round(r.rtMs as number)} ms{r.kind === 'lapse' ? ' · slow' : ''}
    </span>
  );
}

export function FocusView({ snapshot, now, crewName, testProfile, onRespond, onClickRespond, onStimulusRendered, onStop }: FocusViewProps) {
  const targetRef = useRef<HTMLButtonElement>(null);
  const showing = snapshot.phase === 'stimulus';
  const trialKey = snapshot.responses.length;

  useEffect(() => {
    targetRef.current?.focus();
  }, []);

  // The stimulus is in the DOM now; the next animation frame's timestamp becomes its onset (doc 09 §4).
  useLayoutEffect(() => {
    if (showing) onStimulusRendered();
  }, [showing, trialKey, onStimulusRendered]);

  const counter = snapshot.stimulusOnsetAt === null ? 0 : Math.max(0, Math.floor(now - snapshot.stimulusOnsetAt));
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pvt-focus-title" className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-1 px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="pvt-focus-title" className="font-semibold">
            Reaction Self-Test
          </h2>
          <SubjectChip name={crewName} />
          {testProfile && <TestModeBadge profile={testProfile} />}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-text-2">
            {formatClock(snapshot.remainingMs)} left
          </span>
          <Button onClick={onStop}>Stop (Esc)</Button>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <button
          ref={targetRef}
          type="button"
          data-testid="pvt-target"
          aria-label="Respond: press when the red box appears (or press Space)"
          onPointerDown={(e) => {
            e.preventDefault();
            onRespond();
          }}
          onClick={(e) => onClickRespond(e.detail)}
          className="flex h-72 min-h-[120px] w-full max-w-2xl min-w-[120px] touch-none select-none items-center justify-center rounded-card border border-border bg-surface-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          {showing ? (
            <span
              data-testid="pvt-stimulus"
              className="flex h-32 w-72 items-center justify-center rounded-control border-4 border-act bg-act-bg font-mono text-5xl text-text tabular-nums"
            >
              {counter}
            </span>
          ) : snapshot.phase === 'paused' ? (
            <span className="text-xl text-watch-fg">Paused — come back now or the test stops</span>
          ) : (
            <Feedback snapshot={snapshot} now={now} />
          )}
        </button>
        <p className="text-sm text-text-3">Space, any key, or tap the area above. Esc stops the test.</p>
      </div>
    </div>
  );
}
