// Card around one Trends chart: title with the latest value, chart, flagged days, legend, "View data" table.
import { Component, useId, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Table2 } from 'lucide-react';

import type { SignalDef, Verdict } from '../../domain/types';
import { missionDayLabel } from '../../state/missionSelectors';
import type { ChartReferenceLine } from './chartTypes';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ErrorState } from '../../ui/States';
import { StatusPill } from '../../ui/StatusPill';
import { Value } from '../../ui/Value';
import type { DayRange } from './axis';
import type { OverlaySeries } from './chartRows';
import type { TrendEvent } from './events';
import { TrendChart } from './TrendChart';
import { TrendLegend } from './TrendLegend';
import { FlaggedDays, TrendTable } from './TrendTable';
import type { TrendModel } from './trendData';
import { pointSourceIds } from './trendData';

export interface ChartCardProps {
  def: SignalDef;
  model: TrendModel;
  range: DayRange;
  todayDay: number;
  verdict?: Verdict;
  referenceLines?: readonly ChartReferenceLine[];
  events?: readonly TrendEvent[];
  overlays?: readonly OverlaySeries[];
  floorZero?: boolean;
  caption?: ReactNode;
  onSelectRange?: (r: DayRange) => void;
}

export function ChartCard(props: ChartCardProps) {
  const { def, model, range, todayDay, verdict, referenceLines, events, overlays, floorZero, caption } =
    props;
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const latest = model.latest;
  const sourceIds = [
    ...new Set([
      ...(model.tracks.some((t) => t.band) ? model.bandSourceIds : []),
      ...(referenceLines ?? []).flatMap((r) => r.sourceIds),
      ...(model.preflightBand?.sourceIds ?? []),
      ...(model.spaceBand?.sourceIds ?? []),
      'SRC_DEMO_SIMULATION',
    ]),
  ].join(', ');
  return (
    <Card
      as="article"
      headingLevel={2}
      title={model.title}
      data-testid={`trend-${def.id}`}
      data-trend-card=""
      data-source-ids={sourceIds}
      subtitle={latest ? `Latest in view: ${missionDayLabel(latest.missionDay)}` : 'No reading in view'}
      actions={
        <>
          {latest && (
            <Value
              value={latest.value}
              unit={model.unit}
              precision={model.precision}
              sourceIds={pointSourceIds(def, latest)}
              label={latest.measured ? 'MEASURED' : 'SIMULATED'}
              title={model.tracks.length > 1 ? `${def.label} (${latest.trackLabel})` : def.label}
            />
          )}
          {verdict && <StatusPill verdict={verdict} size="sm" />}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TrendChart
          tracks={model.tracks}
          range={range}
          todayDay={todayDay}
          unit={model.unit}
          precision={model.precision}
          preflightBand={model.preflightBand}
          spaceBand={model.spaceBand}
          referenceLines={referenceLines}
          events={events}
          overlays={overlays}
          floorZero={floorZero}
          onSelectRange={props.onSelectRange}
        />
        <FlaggedDays
          markers={model.markers}
          unit={model.unit}
          precision={model.precision}
          def={def}
          multi={model.tracks.length > 1}
        />
        <TrendLegend
          tracks={model.tracks}
          unit={model.unit}
          precision={model.precision}
          bandSourceIds={model.bandSourceIds}
          preflightBand={model.preflightBand}
          spaceBand={model.spaceBand}
          referenceLines={referenceLines}
          events={events}
          markers={model.markers}
          overlays={overlays}
          todayDay={todayDay}
        />
        {caption && <p className="text-xs text-text-2">{caption}</p>}
        <div>
          <Button
            variant="ghost"
            icon={Table2}
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? 'Hide data' : 'View data'}
            <span className="sr-only">: {model.title}</span>
          </Button>
        </div>
        {showTable && (
          <TrendTable
            id={tableId}
            def={def}
            title={model.title}
            tracks={model.tracks}
            unit={model.unit}
            precision={model.precision}
            bandSourceIds={model.bandSourceIds}
          />
        )}
      </div>
    </Card>
  );
}

/** Keeps one broken chart from taking the page down. */
export class ChartBoundary extends Component<
  { title: string; children: ReactNode },
  { error: string | null }
> {
  override state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  override componentDidCatch(e: unknown, info: ErrorInfo) {
    console.warn('Trends chart failed', e, info.componentStack);
  }
  override render() {
    if (this.state.error !== null)
      return (
        <ErrorState
          title={`${this.props.title} could not be drawn`}
          message="This chart failed to render."
          detail={this.state.error}
        />
      );
    return this.props.children;
  }
}
