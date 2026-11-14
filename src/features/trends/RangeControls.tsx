// Range presets + a keyboard range control (two sliders on the day-0-free axis) + "Reset range".
// Dragging across any chart sets the same range (synced brush, doc 11 §5.3).
import { RotateCcw } from 'lucide-react';

import { MIN_MISSION_DAY, missionDayLabel, missionDayText } from '../../state/missionSelectors';
import { Button } from '../../ui/Button';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { RANGE_PRESETS, clampRange, dayToIndex, indexToDay } from './axis';
import type { DayRange, RangePreset } from './axis';

export interface RangeControlsProps {
  preset: RangePreset | null;
  range: DayRange;
  todayDay: number;
  onPreset: (p: RangePreset) => void;
  onRange: (r: DayRange) => void;
  onReset: () => void;
}

const sliderClass =
  'h-11 w-full cursor-pointer accent-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export function RangeControls({ preset, range, todayDay, onPreset, onRange, onReset }: RangeControlsProps) {
  const min = dayToIndex(MIN_MISSION_DAY);
  const max = dayToIndex(todayDay);
  const a = dayToIndex(range.fromDay);
  const b = dayToIndex(range.toDay);
  const set = (from: number, to: number) =>
    onRange(clampRange({ fromDay: indexToDay(from), toDay: indexToDay(to) }, todayDay));
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3" data-testid="range-controls">
      <SegmentedControl
        label="Time range"
        options={RANGE_PRESETS}
        value={preset ?? ('custom' as RangePreset)}
        onChange={onPreset}
      />
      <fieldset className="flex min-w-[260px] flex-1 flex-col gap-1">
        <legend className="text-xs text-text-2">
          Selected range{' '}
          <span className="font-mono text-text" data-testid="range-label">
            {missionDayLabel(range.fromDay)} – {missionDayLabel(range.toDay)}
          </span>
          {preset === null && <span className="ml-2 text-text-3">(custom, applies to every chart)</span>}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col text-xs text-text-2">
            Range start
            <input
              type="range"
              className={sliderClass}
              min={min}
              max={max - 1}
              value={Math.min(a, max - 1)}
              aria-valuetext={missionDayText(range.fromDay)}
              onChange={(e) => set(Math.min(Number(e.target.value), b - 1), b)}
            />
          </label>
          <label className="flex flex-col text-xs text-text-2">
            Range end
            <input
              type="range"
              className={sliderClass}
              min={min + 1}
              max={max}
              value={b}
              aria-valuetext={missionDayText(range.toDay)}
              onChange={(e) => set(a, Math.max(Number(e.target.value), a + 1))}
            />
          </label>
        </div>
      </fieldset>
      <Button variant="ghost" icon={RotateCcw} onClick={onReset} disabled={preset === '30'}>
        Reset range
      </Button>
    </div>
  );
}
