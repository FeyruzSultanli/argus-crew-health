import { RadioTower } from 'lucide-react';

import { EARTH_LINK_SOURCE_IDS } from '../../services/packets';
import { useMissionProfile, useMissionStore } from '../../state/mission';
import { commsDelaySec, delayDisplay, isModeledDelay } from '../../state/missionSelectors';
import { Badge, SegmentedControl, SourceBadge, Value } from '../../ui';

/** One-way delay through <Value>, worded "modeled delay (demo)" on Mars transit and "light-time (computed)" otherwise. */
export function DelayValue({ delaySec, modeled, size = 'md' }: { delaySec: number; modeled: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const d = delayDisplay(delaySec);
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="delay-value">
      <Value
        value={d.value}
        unit={d.unit}
        precision={d.precision}
        sourceIds={EARTH_LINK_SOURCE_IDS}
        size={size}
        title="One-way comms delay"
      />
      <span className="text-xs text-text-2">{modeled ? 'modeled delay (demo)' : 'light-time (computed)'}</span>
    </span>
  );
}

const BASE_OPTIONS = [
  { value: '1', label: 'Real time' },
  { value: '60', label: '60×' },
];

/** Demo time compression (mission store). Every factor is a demo parameter [SRC_DEMO_SIMULATION]. */
export function CompressionControl() {
  const compression = useMissionStore((s) => s.timeCompression);
  const setCompression = useMissionStore((s) => s.setTimeCompression);
  const options = BASE_OPTIONS.some((o) => o.value === String(compression))
    ? BASE_OPTIONS
    : [...BASE_OPTIONS, { value: String(compression), label: `${compression}×` }];
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="compression-control">
      <span className="text-xs text-text-2" id="compression-label">
        Demo time compression
      </span>
      <SegmentedControl
        label="Demo time compression"
        options={options}
        value={String(compression)}
        onChange={(v) => setCompression(Number(v))}
      />
      <Badge tone="neutral" variant="outline">
        Demo parameter
      </Badge>
      <SourceBadge sourceIds={EARTH_LINK_SOURCE_IDS} title="Demo time compression" />
    </div>
  );
}

/** Header strip: current one-way delay, simulated-delivery statement and the compression control. */
export function LinkStatus({ missionDay }: { missionDay: number }) {
  const profile = useMissionProfile();
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4" data-testid="link-status">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-2">
          <RadioTower size={18} aria-hidden="true" className="text-text-2" />
          <span className="text-sm text-text-2">One-way delay now</span>
          <DelayValue delaySec={commsDelaySec(profile, missionDay)} modeled={isModeledDelay(profile)} />
        </span>
        <CompressionControl />
      </div>
      <p className="text-sm text-text-2" data-testid="simulated-delivery">
        Earth-link delivery is simulated (time-compressed). Nothing leaves this device; packets and replies wait the
        one-way delay divided by the demo time compression.
      </p>
    </div>
  );
}
