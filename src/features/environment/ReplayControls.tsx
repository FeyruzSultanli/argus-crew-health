// "Replay SPE" control on the Environment screen (doc 10 §8, doc 14 §3.5). Drives services/replay.ts.
import { Play, RotateCcw, Square } from 'lucide-react';

import { REPLAY_SPEEDS } from '../../domain/radiation/replay';
import { setReplaySpeed, startReplay, stopReplay } from '../../services/replay';
import { useReplay } from '../../services/hooks';
import { Button, SegmentedControl } from '../../ui';
import { formatDuration } from './format';
import { ReplayTag } from './ReplayTag';

type SpeedOpt = `${(typeof REPLAY_SPEEDS)[number]}`;
const OPTIONS = REPLAY_SPEEDS.map((s) => ({ value: String(s) as SpeedOpt, label: `${s}×` }));

export function ReplayControls() {
  const r = useReplay();
  const running = r.status === 'playing' || r.status === 'ended';
  const speedOpt = (OPTIONS.find((o) => Number(o.value) === r.speed)?.value ?? '600') as SpeedOpt;
  const pick = (v: SpeedOpt) => setReplaySpeed(Number(v));
  const total = r.profile ? r.profile.endMs - r.profile.startMs : 0;
  return (
    <section
      aria-label="SPE replay"
      className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-1 px-4 py-3"
      data-testid="replay-controls"
    >
      {running ? (
        <>
          <Button variant="secondary" icon={Square} onClick={stopReplay}>
            Stop replay
          </Button>
          {r.status === 'ended' && (
            <Button variant="ghost" icon={RotateCcw} onClick={() => void startReplay(r.speed)}>
              Replay again
            </Button>
          )}
        </>
      ) : (
        <Button
          variant="primary"
          icon={Play}
          disabled={r.status === 'loading'}
          onClick={() => void startReplay(r.speed)}
        >
          Replay SPE
        </Button>
      )}
      <SegmentedControl options={OPTIONS} value={speedOpt} onChange={pick} label="Replay speed" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs text-text-2" aria-live="polite">
        {running && r.profile ? (
          <>
            <ReplayTag synthetic={r.profile.synthetic} />
            <span className="font-mono" data-testid="replay-clock">
              {r.status === 'ended' ? 'Replay finished' : 'Playing'} · event time {formatDuration(r.eventMs)}{' '}
              of {formatDuration(total)} at {r.speed}×
            </span>
          </>
        ) : (
          <span>
            Plays a synthetic S2-class solar particle event profile (demo), not a recorded event. S level,
            shelter advisory and modeled dose update as it plays; stopping removes the replay&apos;s modeled
            dose.
          </span>
        )}
        {r.error && <span className="text-act-fg">Replay could not load: {r.error}</span>}
      </div>
    </section>
  );
}
