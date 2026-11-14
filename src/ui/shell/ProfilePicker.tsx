import { Check, Info } from 'lucide-react';

import type { MissionProfile, MissionProfileId } from '../../domain/types';
import {
  DELAY_SOURCE_IDS,
  commsDelaySec,
  delayDisplay,
  isModeledDelay,
  missionProfiles,
} from '../../state/missionSelectors';
import { Sheet } from '../Sheet';
import { cx } from '../tone';
import { Value } from '../Value';
import { PROFILE_META } from './profileMeta';

export interface ProfilePickerProps {
  open: boolean;
  onClose: () => void;
  currentId: MissionProfileId;
  onSelect: (id: MissionProfileId) => void;
}

function DelayLine({ profile }: { profile: MissionProfile }) {
  const d = delayDisplay(commsDelaySec(profile, profile.demoMissionDay));
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs text-text-2">
      One-way delay
      <Value
        value={d.value}
        unit={d.unit}
        precision={d.precision}
        sourceIds={DELAY_SOURCE_IDS}
        size="sm"
        title={`${profile.label}: comms delay`}
      />
      {isModeledDelay(profile) && <span>modeled delay (demo)</span>}
    </span>
  );
}

/** The six mission profiles with environment icons and delay (doc 11 §3, doc 05 §6). */
export function ProfilePicker({ open, onClose, currentId, onSelect }: ProfilePickerProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Mission profile"
      description="Switching re-runs the same crew timeline up to that profile's demo day."
    >
      <ul className="flex flex-col gap-2">
        {missionProfiles.map((p) => {
          const meta = PROFILE_META[p.id];
          const Icon = meta.icon;
          const selected = p.id === currentId;
          return (
            <li
              key={p.id}
              className={cx('rounded-card border bg-surface-2', selected ? 'border-brand' : 'border-border')}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelect(p.id);
                  onClose();
                }}
                className="flex min-h-target w-full items-start gap-3 rounded-card px-4 pt-3 pb-1 text-left"
              >
                <Icon size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-text-2" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-text">{p.label}</span>
                  <span className="text-xs text-text-2">{meta.environment}</span>
                </span>
                {selected && (
                  <span className="inline-flex items-center gap-1 text-xs text-brand">
                    <Check size={14} aria-hidden="true" />
                    Active
                  </span>
                )}
              </button>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 pl-[3.25rem]">
                <DelayLine profile={p} />
                <span className="inline-flex items-center gap-x-1.5 text-xs text-text-2">
                  Opens at day
                  <Value
                    value={p.demoMissionDay}
                    sourceIds={['SRC_DEMO_SIMULATION']}
                    size="sm"
                    title="Demo mission day"
                  />
                  of
                  <Value
                    value={p.durationDays}
                    unit="d"
                    sourceIds={['SRC_DEMO_SIMULATION']}
                    size="sm"
                    title="Mission duration"
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex items-start gap-2 rounded-control border border-border bg-surface-2 p-3 text-xs text-text-2">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        Scenarios whose days fall outside a profile's day range do not occur in that profile. Light-time
        delays are computed or fixed for the demo; the Mars transit delay grows along a modeled curve.
      </p>
    </Sheet>
  );
}
