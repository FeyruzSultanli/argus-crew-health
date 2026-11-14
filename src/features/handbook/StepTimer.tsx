// Timer of a protocol step (doc 07 §5 times, e.g. "re-measure in 2 h"). Never blocks: the real duration is shown,
// "Start timer" is optional and "Continue without waiting" moves on. Time compression (mission store) shortens it
// for the demo; the shortened duration is a Demo parameter (SRC_DEMO_SIMULATION).
import { useState } from 'react';
import { Timer } from 'lucide-react';

import { useMissionStore } from '../../state/mission';
import { Button, Countdown, Value } from '../../ui';

const SIM = ['SRC_DEMO_SIMULATION'];
/** Timers sit on demo-wording steps; the times are our own doc 07 choices (no published source). */
const DOC07_DEMO = ['SRC_DEMO_RULE_BANDS'];

/** Best display unit for a duration in seconds. */
function asDuration(sec: number): { value: number; unit: 'h' | 'min' | 's' } {
  if (sec >= 3600 && sec % 360 === 0) return { value: sec / 3600, unit: 'h' };
  if (sec >= 60) return { value: Math.round((sec / 60) * 10) / 10, unit: 'min' };
  return { value: Math.round(sec), unit: 's' };
}

export interface StepTimerProps {
  timerSec: number;
  /** Sources of the step (the duration is part of the step wording). */
  sourceIds: readonly string[];
  label: string;
  /** Injectable clock for tests. */
  now?: () => number;
}

export function StepTimer({ timerSec, sourceIds, label, now = Date.now }: StepTimerProps) {
  const compression = useMissionStore((s) => s.timeCompression);
  const [started, setStarted] = useState<{ at: number; ends: number } | null>(null);
  const [done, setDone] = useState(false);
  const effectiveSec = timerSec / Math.max(1, compression);
  const real = asDuration(timerSec);
  const demo = asDuration(effectiveSec);
  return (
    <div
      className="flex flex-col gap-3 rounded-control border border-border-strong bg-surface-2/50 p-4"
      data-testid="step-timer"
    >
      <p className="flex flex-wrap items-center gap-2 text-sm text-text">
        <Timer size={18} aria-hidden="true" className="text-text-2" />
        Real duration{' '}
        <Value
          value={real.value}
          unit={real.unit}
          sourceIds={sourceIds.length > 0 ? sourceIds : DOC07_DEMO}
          title={label}
        />
      </p>
      {compression > 1 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-text-2" data-testid="timer-compressed">
          Demo timer at{' '}
          <Value value={compression} unit="×" sourceIds={SIM} title="Time compression" size="sm" />:{' '}
          <Value value={demo.value} unit={demo.unit} sourceIds={SIM} title="Compressed timer" size="sm" />
        </p>
      )}
      {started ? (
        <Countdown
          endsAt={started.ends}
          startedAt={started.at}
          label={label}
          onDone={() => setDone(true)}
          now={now}
          size="lg"
          note={done ? 'Timer finished.' : undefined}
        />
      ) : (
        <div>
          <Button
            icon={Timer}
            onClick={() => {
              const at = now();
              setStarted({ at, ends: at + effectiveSec * 1000 });
            }}
          >
            Start timer
          </Button>
        </div>
      )}
    </div>
  );
}
