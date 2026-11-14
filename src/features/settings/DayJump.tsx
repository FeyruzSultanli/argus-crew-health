// "Jump to day" demo control: clamped to the profile range, no day 0.
import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { useMissionProfile, useMissionStore } from '../../state/mission';
import { missionDayLabel } from '../../state/missionSelectors';
import { Button } from '../../ui';
import { MIN_MISSION_DAY, parseDayInput } from './demoScenarios';

export function DayJump() {
  const id = useId();
  const profile = useMissionProfile();
  const missionDay = useMissionStore((s) => s.missionDay);
  const setMissionDay = useMissionStore((s) => s.setMissionDay);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = parseDayInput(text, profile);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setMissionDay(r.day);
    setMsg(
      r.clamped
        ? `Moved to ${missionDayLabel(r.day)}: the ${profile.label} timeline runs from ${missionDayLabel(MIN_MISSION_DAY)} to ${missionDayLabel(profile.demoMissionDay)}, with no day 0.`
        : `Moved to ${missionDayLabel(r.day)}.`,
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" aria-label="Jump to mission day">
      <label htmlFor={id} className="text-sm font-medium text-text">
        Jump to mission day
        <span className="ml-2 font-normal text-text-2">
          now {missionDayLabel(missionDay)}; negative = pre-flight
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={String(profile.demoMissionDay)}
          className="min-h-target w-32 rounded-control border border-border-strong bg-surface-2 px-3 font-mono text-sm text-text"
          data-testid="day-input"
        />
        <Button type="submit">Go</Button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-text-2" data-testid="day-message">
        {msg}
      </p>
    </form>
  );
}
