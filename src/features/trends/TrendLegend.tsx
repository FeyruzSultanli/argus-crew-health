// Legend under a Trends chart: every line, band, marker shape and event with its numbers and source badges.
import type { ReactNode } from 'react';

import { missionDayLabel } from '../../state/missionSelectors';
import type { ChartBand, ChartReferenceLine } from './chartTypes';
import { SourceBadge } from '../../ui/SourceBadge';
import { TONE_VAR } from '../../ui/tone';
import { Value } from '../../ui/Value';
import { overlayDash, trackDash, trackStroke } from './chartRows';
import type { OverlaySeries } from './chartRows';
import type { TrendEvent } from './events';
import type { TrendTrack, VerdictMarker } from './trendData';

export interface TrendLegendProps {
  tracks: readonly TrendTrack[];
  unit: string;
  precision: number;
  bandSourceIds: readonly string[];
  preflightBand?: ChartBand;
  spaceBand?: ChartBand;
  referenceLines?: readonly ChartReferenceLine[];
  events?: readonly TrendEvent[];
  markers?: readonly VerdictMarker[];
  overlays?: readonly OverlaySeries[];
  todayDay: number;
}

function Item({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span aria-hidden="true" className="inline-flex h-3 w-5 items-center justify-center">
        {swatch}
      </span>
      {children}
    </li>
  );
}

const lineSwatch = (stroke: string, dash?: string, width = 2) => (
  <svg width="20" height="6">
    <line x1="0" y1="3" x2="20" y2="3" stroke={stroke} strokeWidth={width} strokeDasharray={dash} />
  </svg>
);

export function TrendLegend(props: TrendLegendProps) {
  const { tracks, unit, precision, bandSourceIds, preflightBand, spaceBand, todayDay } = props;
  const { referenceLines = [], events = [], markers = [], overlays = [] } = props;
  const anyMeasured = tracks.some((t) => t.points.some((p) => p.measured));
  const anyBand = tracks.some((t) => t.band);
  const range = (b: ChartBand) => (
    <>
      <Value value={b.lo} unit={unit} precision={precision} sourceIds={b.sourceIds} size="sm" />
      <span aria-hidden="true">–</span>
      <span className="sr-only">to</span>
      <Value value={b.hi} unit={unit} precision={precision} sourceIds={b.sourceIds} size="sm" />
    </>
  );
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-2">
      {tracks.map((t, i) => (
        <Item key={t.key} swatch={lineSwatch(trackStroke(i), trackDash(i))}>
          {tracks.length > 1 ? t.label : 'Daily value'}
        </Item>
      ))}
      <Item swatch={<span className="size-2 rounded-full bg-text-2" />}>Simulated history (circle)</Item>
      {anyMeasured && <Item swatch={<span className="size-2 bg-brand" />}>Measured reading (square)</Item>}
      {anyBand && (
        <Item swatch={<span className="h-3 w-5 rounded-[3px] bg-text-3/30" />}>
          Personal band (reference ± 2σ)
          <SourceBadge sourceIds={bandSourceIds} title="Personal band" />
        </Item>
      )}
      {preflightBand && (
        <Item swatch={<span className="h-3 w-5 rounded-[3px] border border-dashed border-text-3" />}>
          Pre-flight band {range(preflightBand)}
        </Item>
      )}
      {spaceBand && (
        <Item swatch={<span className="h-3 w-5 rounded-[3px] bg-info/25" />}>
          Expected in space band {range(spaceBand)}
        </Item>
      )}
      {referenceLines.map((r) => (
        <Item key={r.label} swatch={lineSwatch(TONE_VAR[r.tone ?? 'muted'], '4 3')}>
          {r.label}
          <Value
            value={r.y}
            unit={unit}
            precision={precision}
            sourceIds={r.sourceIds}
            size="sm"
            title={r.label}
          />
        </Item>
      ))}
      {markers.some((m) => m.state === 'WATCH') && (
        <Item swatch={<span className="size-2.5 rotate-45 border-2 border-watch" />}>
          Watch day (diamond)
        </Item>
      )}
      {markers.some((m) => m.state === 'ACT') && (
        <Item
          swatch={
            <svg width="14" height="12">
              <path d="M7 0 L14 12 L0 12 Z" fill="var(--act)" />
            </svg>
          }
        >
          Act day (triangle)
        </Item>
      )}
      {events.map((e) => (
        <Item
          key={e.id}
          swatch={
            e.kind === 'launch' ? (
              lineSwatch('var(--text-3)', '1 3')
            ) : (
              <span className="h-3 w-5 rounded-[3px] border border-dashed border-info bg-info/10" />
            )
          }
        >
          <span data-testid={`event-${e.id}`}>
            {e.label}
            {e.kind === 'scenario' &&
              ` (${missionDayLabel(e.fromDay)}${e.toDay !== e.fromDay ? `–${e.toDay}` : ''}, SIMULATED scenario)`}
          </span>
          {e.kind === 'scenario' && <SourceBadge sourceIds={e.sourceIds} title={e.label} label="SIMULATED" />}
        </Item>
      ))}
      <Item swatch={lineSwatch('var(--brand)', undefined, 1.5)}>
        Selected day {missionDayLabel(todayDay)}
      </Item>
      {overlays.map((o, k) => (
        <Item key={o.key} swatch={lineSwatch('var(--text-3)', overlayDash(k), 1)}>
          {o.label}
        </Item>
      ))}
    </ul>
  );
}
