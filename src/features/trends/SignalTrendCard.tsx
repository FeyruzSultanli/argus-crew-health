// Data wiring for one crew signal chart: live hooks → pure model → ChartCard.
import { useEffect, useMemo } from 'react';
import { LineChart } from 'lucide-react';

import crewJson from '../../../seed/crew.json';
import { getSignal } from '../../domain/signals';
import type { Assessment, SignalId } from '../../domain/types';
import { MIN_MISSION_DAY } from '../../state/missionSelectors';
import { useObservations, usePersonalSeries, usePersonalTracks } from '../../services/hooks';
import { Card } from '../../ui/Card';
import { EmptyState, Skeleton } from '../../ui/States';
import type { DayRange } from './axis';
import { dayToIndex, inRange } from './axis';
import type { OverlaySeries } from './chartRows';
import { ChartCard } from './ChartCard';
import type { CsvChart } from './csv';
import { eventsFor } from './events';
import { buildTrendModel, dailyValues } from './trendData';

export interface SignalTrendCardProps {
  crewId: string;
  signalId: SignalId;
  range: DayRange;
  todayDay: number;
  assessment?: Assessment;
  compare: boolean;
  onCsv: (key: string, chart: CsvChart | null) => void;
  onSelectRange: (r: DayRange) => void;
}

const NONE = '__none__';

export function SignalTrendCard(props: SignalTrendCardProps) {
  const { crewId, signalId, range, todayDay, assessment, compare, onCsv, onSelectRange } = props;
  const def = getSignal(signalId);
  const series = usePersonalSeries(crewId, signalId, todayDay);
  const tracks = usePersonalTracks(crewId, signalId, todayDay);
  const observations = useObservations({ crewId, signalId, fromDay: MIN_MISSION_DAY, toDay: todayDay });
  const others = useObservations({
    crewId: compare ? undefined : NONE,
    signalId,
    fromDay: range.fromDay,
    toDay: range.toDay,
  });
  const personal = assessment?.layers.personal;

  const model = useMemo(() => {
    if (series === undefined || tracks === undefined || observations === undefined) return undefined;
    return buildTrendModel({ def, range, series, tracks, observations, personal });
  }, [def, range, series, tracks, observations, personal]);

  const overlays = useMemo<OverlaySeries[]>(() => {
    if (!compare || !others) return [];
    const track = tracks && tracks.length > 0 ? tracks[0] : undefined;
    return crewJson.crew
      .filter((c) => c.id !== crewId)
      .map((c) => {
        const daily = dailyValues(
          others.filter((o) => o.crewId === c.id),
          track,
        );
        const points = [...daily.entries()]
          .filter(([d]) => inRange(d, range))
          .map(([d, e]) => ({ x: dayToIndex(d), value: e.value }))
          .sort((a, b) => a.x - b.x);
        return { key: c.id, label: c.displayName, points };
      })
      .filter((o) => o.points.length > 0);
  }, [compare, others, tracks, crewId, range]);

  const crewName = crewJson.crew.find((c) => c.id === crewId)?.displayName ?? crewId;
  useEffect(() => {
    onCsv(
      signalId,
      model ? { signal: signalId, crew: crewName, unit: model.unit, tracks: model.tracks } : null,
    );
  }, [model, signalId, crewName, onCsv]);
  useEffect(() => () => onCsv(signalId, null), [signalId, onCsv]);

  if (model === undefined) {
    return (
      <Card as="article" headingLevel={2} title={def.label} data-testid={`trend-${signalId}`}>
        <Skeleton variant="block" className="h-48" label={`Loading ${def.label}`} />
      </Card>
    );
  }
  if (model.tracks.every((t) => t.points.length === 0)) {
    return (
      <Card as="article" headingLevel={2} title={def.label} data-testid={`trend-${signalId}`}>
        <EmptyState
          icon={LineChart}
          title="No readings in this range"
          body={`${def.label} has no readings between the selected days. Widen the range or measure in the Lab.`}
        />
      </Card>
    );
  }
  return (
    <ChartCard
      def={def}
      model={model}
      range={range}
      todayDay={todayDay}
      verdict={assessment?.verdict}
      events={eventsFor(crewId, signalId, range)}
      overlays={overlays}
      caption={
        compare && overlays.length > 0
          ? "Thin lines: other crew members' daily values. Their own personal bands are not drawn."
          : !def.personal.enabled
            ? 'No personal band for this signal: it is judged by space and Earth rules only.'
            : undefined
      }
      onSelectRange={onSelectRange}
    />
  );
}
