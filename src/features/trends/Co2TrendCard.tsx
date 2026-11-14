// Cabin CO₂ chart: 1-h and 7-day average lines with the NASA limits and the Earth comparison lines (doc 11 §5.3).
import { useEffect, useMemo } from 'react';
import { Wind } from 'lucide-react';

import { getSignal } from '../../domain/signals';
import { CANONICAL_UNIT, DISPLAY_PRECISION } from '../../domain/units';
import type { Verdict } from '../../domain/types';
import { MIN_MISSION_DAY } from '../../state/missionSelectors';
import { useObservations } from '../../services/hooks';
import { Card } from '../../ui/Card';
import { EmptyState, Skeleton } from '../../ui/States';
import type { DayRange } from './axis';
import { ChartCard } from './ChartCard';
import { CO2_PRIMARY_LINES, CO2_SECONDARY_LINES, co2Tracks } from './co2';
import type { CsvChart } from './csv';
import { eventsFor } from './events';
import type { TrendModel } from './trendData';

export interface Co2TrendCardProps {
  range: DayRange;
  todayDay: number;
  verdict?: Verdict;
  onCsv: (key: string, chart: CsvChart | null) => void;
  onSelectRange: (r: DayRange) => void;
}

const LINES = [...CO2_PRIMARY_LINES, ...CO2_SECONDARY_LINES];

export function Co2TrendCard({ range, todayDay, verdict, onCsv, onSelectRange }: Co2TrendCardProps) {
  const def = getSignal('cabin_co2');
  const obs = useObservations({
    crewId: 'cabin',
    signalId: 'cabin_co2',
    fromDay: MIN_MISSION_DAY,
    toDay: todayDay,
  });
  const model = useMemo<TrendModel | undefined>(() => {
    if (obs === undefined) return undefined;
    const tracks = co2Tracks(obs, range);
    const m: TrendModel = {
      signalId: 'cabin_co2',
      title: def.label,
      unit: obs[0]?.unit ?? CANONICAL_UNIT.cabin_co2,
      precision: DISPLAY_PRECISION.cabin_co2,
      tracks,
      bandSourceIds: [],
      markers: [],
    };
    const last = tracks[0]?.points[tracks[0].points.length - 1];
    if (last) m.latest = { ...last, trackLabel: '1-h average' };
    return m;
  }, [obs, range, def.label]);

  useEffect(() => {
    onCsv(
      'cabin_co2',
      model ? { signal: 'cabin_co2', crew: 'cabin', unit: model.unit, tracks: model.tracks } : null,
    );
  }, [model, onCsv]);
  useEffect(() => () => onCsv('cabin_co2', null), [onCsv]);

  if (model === undefined) {
    return (
      <Card as="article" headingLevel={2} title={def.label} data-testid="trend-cabin_co2">
        <Skeleton variant="block" className="h-48" label="Loading cabin CO₂" />
      </Card>
    );
  }
  if (model.tracks.every((t) => t.points.length === 0)) {
    return (
      <Card as="article" headingLevel={2} title={def.label} data-testid="trend-cabin_co2">
        <EmptyState icon={Wind} title="No cabin CO₂ readings in this range" />
      </Card>
    );
  }
  return (
    <ChartCard
      def={def}
      model={model}
      range={range}
      todayDay={todayDay}
      verdict={verdict}
      referenceLines={LINES}
      events={eventsFor('cabin', 'cabin_co2', range)}
      floorZero
      caption="Cabin air, shared by the whole crew. Dashed grey lines are Earth comparisons. SIMULATED cabin data."
      onSelectRange={onSelectRange}
    />
  );
}
