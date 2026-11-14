// Demo controls (FR-SET-2, P0): scenario picker, jump to day, mission profile, time compression, SPE replay.
// "Reset demo" sits next to the visibility toggle on the Settings page, so it is reachable with the controls hidden.
// Shown with `?demo=1` or the Settings toggle. Everything here is clearly a DEMO control.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Orbit } from 'lucide-react';

import { useMissionProfile, useMissionStore } from '../../state/mission';
import { missionDayLabel } from '../../state/missionSelectors';
import { useUiStore } from '../../state/ui';
import { Badge, Button, Card, ProfilePicker, SegmentedControl, Value } from '../../ui';
import { crewName } from './crewNames';
import { DayJump } from './DayJump';
import { ReplayPanel } from './ReplayPanel';
import { ScenarioPicker } from './ScenarioPicker';

/** Real seconds → demo seconds (Earth-link countdowns, protocol timers). Demo parameter. */
const TIME_COMPRESSION_OPTIONS = [1, 10, 60, 600] as const;
const SIM = ['SRC_DEMO_SIMULATION'];

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {children}
    </div>
  );
}

export function DemoControls() {
  const profile = useMissionProfile();
  const missionDay = useMissionStore((s) => s.missionDay);
  const setProfile = useMissionStore((s) => s.setProfile);
  const compression = useMissionStore((s) => s.timeCompression);
  const setCompression = useMissionStore((s) => s.setTimeCompression);
  const selected = useUiStore((s) => s.selectedCrewId);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Card
      title="Demo controls"
      subtitle="Demo only: these change the simulated timeline, not real data"
      actions={
        <Badge mono variant="outline">
          Demo
        </Badge>
      }
      className="border-dashed"
      data-testid="demo-controls"
    >
      <p className="mb-4 font-mono text-xs text-text-2" data-testid="demo-state">
        {profile.label} · {missionDayLabel(missionDay)} · selected crew member:{' '}
        <span data-testid="demo-selected-crew">{crewName(selected)}</span>
      </p>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">Scenarios</h3>
          <p className="text-sm text-text-2">
            All scenarios live on one Mars-transit timeline. Jump goes to the scenario&apos;s last day and
            selects its crew member.
          </p>
          <ScenarioPicker />
        </div>
        <Row title="Mission day">
          <DayJump />
        </Row>
        <Row title="Mission profile">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-text">{profile.label}</span>
            <Button icon={Orbit} onClick={() => setPickerOpen(true)}>
              Change profile
            </Button>
          </div>
          <ProfilePicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            currentId={profile.id}
            onSelect={(id) => {
              setProfile(id);
              setPickerOpen(false);
            }}
          />
        </Row>
        <Row title="Time compression">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl<string>
              label="Time compression"
              options={TIME_COMPRESSION_OPTIONS.map((v) => ({ value: String(v), label: `${v}×` }))}
              value={String(compression)}
              onChange={(v) => setCompression(Number(v))}
            />
            <span className="text-sm text-text-2">
              Now <Value value={compression} unit="×" sourceIds={SIM} title="Time compression" size="sm" />
            </span>
          </div>
          <p className="text-sm text-text-2">
            Shortens Earth-link countdowns and protocol timers for the demo. 1× is real time.
          </p>
        </Row>
        <Row title="Replay solar particle event">
          <ReplayPanel />
        </Row>
      </div>
    </Card>
  );
}
