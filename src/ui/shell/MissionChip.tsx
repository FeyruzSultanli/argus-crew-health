import { useState } from 'react';
import { ChevronDown, RadioTower } from 'lucide-react';

import { useMissionProfile, useMissionStore } from '../../state/mission';
import {
  DELAY_SOURCE_IDS,
  commsDelaySec,
  delayDisplay,
  isModeledDelay,
  missionDayLabel,
} from '../../state/missionSelectors';
import { Value } from '../Value';
import { PROFILE_META } from './profileMeta';
import { ProfilePicker } from './ProfilePicker';

/** Header mission chip: profile + mission day + live one-way delay; opens the profile picker (doc 11 §3). */
export function MissionChip({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const profile = useMissionProfile();
  const missionDay = useMissionStore((s) => s.missionDay);
  const setProfile = useMissionStore((s) => s.setProfile);
  const meta = PROFILE_META[profile.id];
  const Icon = meta.icon;
  const d = delayDisplay(commsDelaySec(profile, missionDay));
  const modeled = isModeledDelay(profile);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title={modeled ? 'One-way delay: modeled delay (demo). Change profile' : undefined}
        className="inline-flex min-h-target items-center gap-2 rounded-control border border-border-strong bg-surface-2 px-2.5 py-0.5 text-left hover:border-text-3"
        data-testid="mission-chip"
      >
        <Icon size={18} aria-hidden="true" className="shrink-0 text-text-2" />
        <span className="flex flex-col leading-tight">
          <span className="font-mono text-xs font-medium tracking-wider text-text uppercase">
            <span className="sr-only">Mission profile: </span>
            {meta.short}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-text-2">
            <span>
              {missionDayLabel(missionDay)}
              <span className="text-text-3 max-[1400px]:hidden">/{profile.durationDays}</span>
            </span>
            {!compact && (
              <>
                <span aria-hidden="true" className="text-text-3">
                  ·
                </span>
                <RadioTower size={12} aria-hidden="true" />
                <span className="sr-only">, one-way delay</span>
                <Value
                  value={d.value}
                  unit={d.unit}
                  precision={d.precision}
                  sourceIds={DELAY_SOURCE_IDS}
                  size="sm"
                  interactive={false}
                />
              </>
            )}
          </span>
          {modeled && !compact && (
            <span
              aria-hidden="true"
              className="font-mono text-[11px] leading-3 text-text-3"
              data-testid="mission-chip-modeled"
            >
              modeled (demo)
            </span>
          )}
        </span>
        <span className="sr-only">{modeled ? ', modeled delay (demo)' : ''}. Change profile</span>
        <ChevronDown size={16} aria-hidden="true" className="text-text-3" />
      </button>
      <ProfilePicker
        open={open}
        onClose={() => setOpen(false)}
        currentId={profile.id}
        onSelect={setProfile}
      />
    </>
  );
}
