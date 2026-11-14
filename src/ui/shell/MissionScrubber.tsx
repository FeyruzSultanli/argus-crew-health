import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Play, Undo2 } from 'lucide-react';

import { useMissionProfile, useMissionStore } from '../../state/mission';
import {
  MIN_MISSION_DAY,
  dayToIndex,
  indexToDay,
  maxMissionDay,
  missionDayLabel,
  missionDayText,
} from '../../state/missionSelectors';
import type { FlagDensityDay } from '../../state/ui';
import { Button } from '../Button';
import { KeyHint } from '../KeyHint';
import { Tooltip } from '../Tooltip';
import { cx } from '../tone';

export interface MissionScrubberProps {
  /** WATCH/ACT counts per mission day (days without an entry draw no bar). */
  density: readonly FlagDensityDay[];
  /** Replay button. Hidden when omitted. */
  onReplay?: () => void;
  className?: string;
}

const BAR_MAX = 24; // px of the 40 px timeline used by bars

/**
 * Mission scrubber dock (doc 11 §3): 40 px timeline with per-day WATCH/ACT bars. Drag or use the keyboard
 * (←/→ one day, Shift+←/→ one week, Home/End) to move useMissionStore.missionDay. Day 0 does not exist.
 */
export function MissionScrubber({ density, onReplay, className }: MissionScrubberProps) {
  const profile = useMissionProfile();
  const missionDay = useMissionStore((s) => s.missionDay);
  const setMissionDay = useMissionStore((s) => s.setMissionDay);
  const stepDay = useMissionStore((s) => s.stepDay);
  const resetToToday = useMissionStore((s) => s.resetToToday);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const today = maxMissionDay(profile);
  const count = dayToIndex(today) + 1; // number of reachable days
  const pct = (day: number) => (count > 1 ? (dayToIndex(day) / (count - 1)) * 100 : 0);

  const bars = useMemo(() => {
    const visible = density.filter(
      (d) => d.missionDay >= MIN_MISSION_DAY && d.missionDay <= today && d.missionDay !== 0,
    );
    const max = Math.max(1, ...visible.map((d) => d.watch + d.act));
    return visible.map((d) => ({
      x: dayToIndex(d.missionDay),
      act: (d.act / max) * BAR_MAX,
      watch: (d.watch / max) * BAR_MAX,
      d,
    }));
  }, [density, today]);

  const dayAt = (clientX: number) => {
    const rect = trackRef.current?.firstElementChild?.getBoundingClientRect();
    if (!rect || rect.width === 0) return missionDay;
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return indexToDay(Math.round(frac * (count - 1)));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.focus();
    setDragging(true);
    setMissionDay(dayAt(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) setMissionDay(dayAt(e.clientX));
  };
  const endDrag = () => setDragging(false);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const week = e.shiftKey ? 7 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') stepDay(week);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') stepDay(-week);
    else if (e.key === 'PageUp') stepDay(30);
    else if (e.key === 'PageDown') stepDay(-30);
    else if (e.key === 'Home') setMissionDay(MIN_MISSION_DAY);
    else if (e.key === 'End') setMissionDay(today);
    else return;
    e.preventDefault();
  };

  const current = bars.find((b) => b.d.missionDay === missionDay)?.d;
  const valueText = `${missionDayText(missionDay)}${missionDay === today ? ', today' : ''}${
    current ? `, ${current.act} act and ${current.watch} watch flags` : ''
  }`;

  return (
    <section
      aria-label="Mission timeline"
      className={cx('flex min-h-14 items-center gap-2 border-t border-border bg-surface-1 px-3', className)}
      data-testid="mission-scrubber"
    >
      <Button
        variant="ghost"
        icon={ChevronLeft}
        iconOnly
        onClick={() => stepDay(-1)}
        disabled={missionDay <= MIN_MISSION_DAY}
      >
        Previous day
      </Button>
      <Button
        variant="ghost"
        icon={ChevronRight}
        iconOnly
        onClick={() => stepDay(1)}
        disabled={missionDay >= today}
      >
        Next day
      </Button>
      <Tooltip
        side="top"
        content={
          <span className="flex flex-col gap-1">
            <KeyHint keys={['←', '→']} label="One day" />
            <KeyHint keys={['Shift', '←/→']} label="One week" />
            <KeyHint keys={['Home', 'End']} label="Pre-flight start / today" />
          </span>
        }
        className="min-w-0 flex-1"
      >
        {(describedBy) => (
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Mission day"
            aria-describedby={describedBy}
            aria-valuemin={MIN_MISSION_DAY}
            aria-valuemax={today}
            aria-valuenow={missionDay}
            aria-valuetext={valueText}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative flex h-target w-full cursor-ew-resize items-center touch-none rounded-control select-none"
          >
            <div className="relative h-10 w-full">
              {/* pre-flight region */}
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-l-control bg-surface-2"
                style={{ width: `${pct(-1)}%` }}
              />
              <svg
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-full w-full"
                viewBox={`0 0 ${count} 40`}
                preserveAspectRatio="none"
              >
                <line
                  x1={0}
                  x2={count}
                  y1={32.5}
                  y2={32.5}
                  stroke="var(--border-strong)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                {bars.map((b) => (
                  <g key={b.x}>
                    {b.act > 0 && (
                      <rect x={b.x} width={0.8} y={32 - b.act} height={b.act} fill="var(--act)" />
                    )}
                    {b.watch > 0 && (
                      <rect
                        x={b.x}
                        width={0.8}
                        y={32 - b.act - b.watch}
                        height={b.watch}
                        fill="var(--watch)"
                      />
                    )}
                  </g>
                ))}
              </svg>
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 font-mono text-[10px] leading-none text-text-3"
              >
                {missionDayLabel(MIN_MISSION_DAY)}
              </span>
              <span
                aria-hidden="true"
                className="absolute bottom-0 border-l border-text-3 pl-1 font-mono text-[10px] leading-none text-text-2"
                style={{ left: `${pct(1)}%` }}
              >
                Launch
              </span>
              <span
                aria-hidden="true"
                className="absolute right-0 bottom-0 font-mono text-[10px] leading-none text-text-3"
              >
                {missionDayLabel(today)}
              </span>
              {/* thumb */}
              <span
                aria-hidden="true"
                className={cx(
                  'absolute top-0 bottom-2 w-0.5 -translate-x-1/2 bg-brand',
                  !dragging && 'transition-[left] duration-150 ease-out',
                )}
                style={{ left: `${pct(missionDay)}%` }}
              >
                <span className="absolute -top-0.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-pill border-2 border-surface-1 bg-brand" />
              </span>
            </div>
          </div>
        )}
      </Tooltip>
      <div className="flex min-w-28 flex-col items-end leading-tight" aria-live="off">
        <span className="font-mono text-sm text-text">{missionDayLabel(missionDay)}</span>
        <span className="text-xs text-text-2">{missionDay === today ? 'Today' : 'Time travel'}</span>
      </div>
      {missionDay !== today && (
        <Button variant="ghost" icon={Undo2} onClick={resetToToday}>
          Today
        </Button>
      )}
      {onReplay && (
        <Button variant="secondary" icon={Play} onClick={onReplay}>
          Replay
        </Button>
      )}
    </section>
  );
}
