import type { ReactNode } from 'react';
import { BedDouble, ChevronDown, Dumbbell, GlassWater, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { SourceBadge, Value } from '../../ui';

interface Item {
  id: string;
  icon: LucideIcon;
  title: string;
  /** Sourced fact (from the source's `says` field). */
  fact: ReactNode;
  sourceIds: string[];
  /** Plain habit wording beyond the sourced fact, tagged "demo wording" (doc 07 §4.6). */
  demoWording?: string;
}

const ITEMS: Item[] = [
  {
    id: 'sleep',
    icon: BedDouble,
    title: 'Sleep',
    fact: (
      <>
        NASA schedules{' '}
        <Value value={8.5} unit="h" sourceIds={['SRC_SLEEP_BARGER']} size="sm" title="Scheduled sleep" /> of
        sleep; measured sleep on ISS missions averaged about{' '}
        <Value value={6.1} unit="h" sourceIds={['SRC_SLEEP_BARGER']} size="sm" title="Measured ISS sleep" />.
      </>
    ),
    sourceIds: ['SRC_SLEEP_BARGER'],
    demoWording: 'Habits: light, schedule, noise, caffeine timing.',
  },
  {
    id: 'hydration',
    icon: GlassWater,
    title: 'Hydration',
    fact: (
      <>
        At least{' '}
        <Value
          value={2.5}
          unit="L/d"
          sourceIds={['SRC_STD3001_ECLSS']}
          size="sm"
          title="Water per crewmember"
        />{' '}
        of water per crewmember (NASA-STD-3001 V2 6109).
      </>
    ),
    sourceIds: ['SRC_STD3001_ECLSS'],
  },
  {
    id: 'exercise',
    icon: Dumbbell,
    title: 'Exercise',
    fact: (
      <>
        ISS crew members average about{' '}
        <Value value={2} unit="h" sourceIds={['SRC_EXERCISE_2H']} size="sm" title="Daily exercise" /> of
        exercise per day.
      </>
    ),
    sourceIds: ['SRC_EXERCISE_2H'],
  },
  {
    id: 'co2',
    icon: Wind,
    title: 'CO₂ awareness',
    fact: (
      <>
        1-hour average limit{' '}
        <Value value={3} unit="mm[Hg]" sourceIds={['SRC_STD3001_CO2']} size="sm" title="CO₂ 1-h limit" />;
        headache risk stays below{' '}
        <Value value={1} unit="%" sourceIds={['SRC_NASA_CO2_PAGE']} size="sm" title="Headache risk" /> with a
        7-day average under{' '}
        <Value
          value={2.5}
          unit="mm[Hg]"
          sourceIds={['SRC_NASA_CO2_PAGE']}
          size="sm"
          title="CO₂ 7-day average"
        />
        .
      </>
    ),
    sourceIds: ['SRC_STD3001_CO2', 'SRC_NASA_CO2_PAGE'],
  },
];

/** Countermeasure guidance (FR-PLAN-4): sourced facts only, collapsible. */
export function Countermeasures() {
  return (
    <details
      className="group rounded-control border border-border bg-surface-2"
      data-testid="countermeasures"
    >
      <summary className="flex min-h-target cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium text-text">
        <span>Countermeasures: sleep, hydration, exercise, CO₂</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="text-text-2 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="grid grid-cols-1 gap-3 px-3 pb-3 md:grid-cols-2">
        {ITEMS.map(({ id, icon: Icon, title, fact, sourceIds, demoWording }) => (
          <li key={id} className="flex gap-3 rounded-control border border-border bg-surface-1 p-3">
            <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-text-2" />
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="flex items-center gap-2 font-medium text-text">
                {title}
                <SourceBadge sourceIds={sourceIds} title={title} />
              </span>
              <span className="text-text-2">{fact}</span>
              {demoWording && (
                <span className="text-text-2">
                  {demoWording}{' '}
                  <span className="rounded-[4px] border border-dashed border-border-strong px-1 font-mono text-[10px] tracking-wider text-text-3 uppercase">
                    demo wording
                  </span>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
