// One Trends chart (Recharts 3): tracks, personal band, pre-flight dashed band, space-expected band, reference lines,
// event markers, "today" line, verdict glyphs and drag-to-select a range (synced across charts by the page).
// Composed here instead of ui/BandChart, which has no controlled x-domain, brush or overlays.
import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useReducedMotionPreference } from '../../state/hooks';
import { useUiStore } from '../../state/ui';
import type { ChartBand, ChartReferenceLine } from './chartTypes';
import { TONE_VAR } from '../../ui/tone';
import { formatNumber, toDisplayUnit, unitSymbol } from '../../ui/units';
import { axisTicks, dayToIndex, indexToDay, tickLabel } from './axis';
import type { DayRange } from './axis';
import { TrendDot, TrendTooltip } from './chartParts';
import { overlayDash, trackDash, trackStroke, buildRows, yScale } from './chartRows';
import type { ChartRow, OverlaySeries } from './chartRows';
import type { TrendEvent } from './events';
import type { TrendTrack } from './trendData';

export interface TrendChartProps {
  tracks: readonly TrendTrack[];
  range: DayRange;
  todayDay: number;
  unit: string;
  precision: number;
  preflightBand?: ChartBand;
  spaceBand?: ChartBand;
  referenceLines?: readonly ChartReferenceLine[];
  events?: readonly TrendEvent[];
  overlays?: readonly OverlaySeries[];
  floorZero?: boolean;
  height?: number;
  /** Drag across the plot selects a range (applied to every chart). */
  onSelectRange?: (r: DayRange) => void;
}

const AXIS_TICK = { fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' };

type Label = number | string | undefined;

export function TrendChart(props: TrendChartProps) {
  const { tracks, range, todayDay, unit, precision, preflightBand, spaceBand } = props;
  const { referenceLines = [], events = [], overlays = [], floorZero, height = 200, onSelectRange } = props;
  const reduced = useReducedMotionPreference();
  const prefs = useUiStore((s) => s.units);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const rows = buildRows(tracks, overlays);
  const x0 = dayToIndex(range.fromDay);
  const x1 = dayToIndex(range.toDay);
  const y = yScale(tracks, { bands: [preflightBand, spaceBand], lines: referenceLines, overlays, floorZero });
  const tickPrecision = Math.max(0, -Math.floor(Math.log10((y.ticks[1] ?? 1) - (y.ticks[0] ?? 0)) + 1e-9));
  const fmtY = (v: number) => formatNumber(toDisplayUnit(v, unit, prefs).value, precision);
  const fmtTick = (v: number) =>
    formatNumber(
      toDisplayUnit(v, unit, prefs).value,
      unit === 'Cel' && prefs.temp !== 'Cel' ? 1 : tickPrecision,
    );
  const sym = unitSymbol(toDisplayUnit(0, unit, prefs).unit);
  const toX = (l: Label) => (typeof l === 'number' ? l : l === undefined ? undefined : Number(l));
  const finish = () => {
    if (drag && onSelectRange && Math.abs(drag.b - drag.a) >= 1) {
      onSelectRange({
        fromDay: indexToDay(Math.min(drag.a, drag.b)),
        toDay: indexToDay(Math.max(drag.a, drag.b)),
      });
    }
    setDrag(null);
  };

  return (
    <div aria-hidden="true" className="w-full select-none" style={{ height }} data-trend-svg="">
      <ComposedChart
        responsive
        accessibilityLayer={false}
        data={rows}
        margin={{ top: 18, right: 14, bottom: 0, left: 0 }}
        style={{ width: '100%', height }}
        onMouseDown={(s) => {
          const x = toX(s.activeLabel);
          if (x !== undefined && Number.isFinite(x)) setDrag({ a: x, b: x });
        }}
        onMouseMove={(s) => {
          const x = toX(s.activeLabel);
          if (drag && x !== undefined && Number.isFinite(x)) setDrag({ a: drag.a, b: x });
        }}
        onMouseUp={finish}
        onMouseLeave={() => setDrag(null)}
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="x"
          type="number"
          domain={[x0, x1]}
          allowDataOverflow
          ticks={axisTicks(range)}
          tickFormatter={tickLabel}
          tick={AXIS_TICK}
          stroke="var(--border-strong)"
          tickLine={false}
        />
        <YAxis
          domain={y.domain}
          ticks={y.ticks}
          allowDataOverflow
          tickFormatter={fmtTick}
          tick={AXIS_TICK}
          stroke="var(--border-strong)"
          tickLine={false}
          width={44}
          label={
            sym
              ? {
                  value: sym,
                  position: 'insideTopLeft',
                  offset: 0,
                  dy: -14,
                  fill: 'var(--text-3)',
                  fontSize: 11,
                }
              : undefined
          }
        />
        {events
          .filter((e) => e.kind === 'scenario')
          .map((e) => (
            <ReferenceArea
              key={e.id}
              x1={Math.max(x0, dayToIndex(e.fromDay) - 0.5)}
              x2={Math.min(x1, dayToIndex(e.toDay) + 0.5)}
              fill="var(--info)"
              fillOpacity={0.08}
              stroke="var(--info)"
              strokeOpacity={0.5}
              strokeDasharray="2 2"
              ifOverflow="hidden"
              label={{
                value: e.label,
                position: dayToIndex(e.fromDay) - x0 > (x1 - x0) * 0.6 ? 'insideTopRight' : 'insideTopLeft',
                fill: 'var(--text-2)',
                fontSize: 10,
              }}
            />
          ))}
        {preflightBand && (
          <ReferenceArea
            y1={preflightBand.lo}
            y2={preflightBand.hi}
            fill="transparent"
            stroke="var(--text-3)"
            strokeDasharray="5 4"
            ifOverflow="hidden"
          />
        )}
        {spaceBand && (
          <ReferenceArea
            y1={spaceBand.lo}
            y2={spaceBand.hi}
            x1={Math.max(x0, dayToIndex(spaceBand.fromDay ?? 1))}
            x2={x1}
            fill="var(--info)"
            fillOpacity={0.12}
            stroke="none"
            ifOverflow="hidden"
          />
        )}
        {tracks.map((t, i) =>
          t.band ? (
            <Area
              key={`b${t.key}`}
              type="stepAfter"
              dataKey={`b${i}`}
              stroke="none"
              fill="var(--text-3)"
              fillOpacity={0.2}
              isAnimationActive={!reduced}
              animationDuration={250}
              activeDot={false}
              connectNulls={false}
            />
          ) : null,
        )}
        {[...referenceLines]
          .sort((a, b) => a.y - b.y)
          .map((r, k) => (
            <ReferenceLine
              key={r.label}
              y={r.y}
              stroke={TONE_VAR[r.tone ?? 'muted']}
              strokeDasharray="4 3"
              ifOverflow="hidden"
              label={
                // in-chart value labels for the status lines only (secondary lines: legend), lowest one below its line
                r.tone && r.tone !== 'muted'
                  ? {
                      value: `${fmtY(r.y)} ${sym}`,
                      position: k === 0 ? 'insideBottomRight' : 'insideTopRight',
                      fill: 'var(--text-2)',
                      fontSize: 10,
                    }
                  : undefined
              }
            />
          ))}
        {events
          .filter((e) => e.kind === 'launch')
          .map((e) => (
            <ReferenceLine
              key={e.id}
              x={dayToIndex(e.fromDay)}
              stroke="var(--text-3)"
              strokeDasharray="1 3"
              ifOverflow="hidden"
              label={{ value: e.label, position: 'insideTopRight', fill: 'var(--text-2)', fontSize: 10 }}
            />
          ))}
        <ReferenceLine x={dayToIndex(todayDay)} stroke="var(--brand)" strokeWidth={1.5} ifOverflow="hidden" />
        {overlays.map((o, k) => (
          <Line
            key={o.key}
            dataKey={`o_${o.key}`}
            stroke="var(--text-3)"
            strokeWidth={1}
            strokeDasharray={overlayDash(k)}
            dot={false}
            activeDot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
        {tracks.map((t, i) => (
          <Line
            key={t.key}
            dataKey={`v${i}`}
            stroke={trackStroke(i)}
            strokeDasharray={trackDash(i)}
            strokeWidth={1.75}
            connectNulls
            isAnimationActive={!reduced}
            animationDuration={250}
            dot={(p: DotArg) => <TrendDot key={p.index} {...p} i={i} stroke={trackStroke(i)} />}
            activeDot={{ r: 5, fill: 'var(--brand)', stroke: 'var(--surface-1)' }}
          />
        ))}
        {drag && drag.a !== drag.b && (
          <ReferenceArea
            x1={Math.min(drag.a, drag.b)}
            x2={Math.max(drag.a, drag.b)}
            fill="var(--brand)"
            fillOpacity={0.15}
          />
        )}
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)' }}
          isAnimationActive={false}
          content={(p) => (
            <TrendTooltip
              active={p.active}
              payload={p.payload as TooltipPayload}
              tracks={tracks}
              overlays={overlays}
              unit={unit}
              precision={precision}
            />
          )}
        />
      </ComposedChart>
    </div>
  );
}

type DotArg = { cx?: number; cy?: number; index?: number; payload?: ChartRow };
type TooltipPayload = ReadonlyArray<{ payload?: ChartRow }>;
