// "Replay SPE" demo control, built against the replayControl adapter.
import { useState } from 'react';
import { ArrowRight, Play, Square } from 'lucide-react';

import { useMissionStore } from '../../state/mission';
import { Button, LinkButton, SegmentedControl, SourceBadge } from '../../ui';
import { REPLAY_SPEEDS, replayControl, replaySpeed } from './replayControl';
import type { ReplayControl, ReplaySpeed } from './replayControl';

export function ReplayPanel({ control = replayControl }: { control?: ReplayControl }) {
  const [speed, setSpeed] = useState<ReplaySpeed>(replaySpeed);
  const active = useMissionStore((s) => s.replay.active);
  const off = !control.available;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<string>
          label="Replay speed"
          options={REPLAY_SPEEDS.map((v) => ({ value: String(v), label: `${v}×` }))}
          value={String(speed)}
          onChange={(v) => {
            const next = Number(v) as ReplaySpeed;
            setSpeed(next);
            if (!off) control.setSpeed(next);
          }}
        />
        <SourceBadge sourceIds={['SRC_DEMO_RADIATION_MODEL']} title="Synthetic SPE replay" />
        {active && !off ? (
          <Button icon={Square} onClick={() => control.stop()}>
            Stop replay
          </Button>
        ) : (
          <Button icon={Play} disabled={off} onClick={() => control.start(speed)}>
            Start replay
          </Button>
        )}
      </div>
      {off && (
        <p className="flex flex-wrap items-center gap-3 text-sm text-text-2" data-testid="replay-unavailable">
          Replay is driven from the Environment screen.
          <LinkButton to="/environment" icon={ArrowRight}>
            Open Environment
          </LinkButton>
        </p>
      )}
    </div>
  );
}
