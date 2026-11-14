import { useId, useState } from 'react';
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
import { Table2 } from 'lucide-react';

import type { PersonalResult } from '../domain/types';
import { missionDayLabel } from '../state/missionSelectors';
import { useReducedMotionPreference } from '../state/hooks';
import { Button } from './Button';
import { BandChartTable } from './BandChartTable';
import { TONE_VAR, VERDICT } from './tone';
import { unitSymbol } from './units';
import { BandChartLegend } from './BandChartLegend';
import type { ChartBand, ChartEvent, ChartReferenceLine } from './BandChartLegend';

export type { ChartBand, ChartEvent, ChartReferenceLine } from './BandChartLegend';

export interface BandChartProps {
  /** Personal series with band per day (PersonalResult['series'], doc 08 §6). */
  series: PersonalResult['series'];
  /** Chart title, also the accessible name. */
  title: string;
  unit?: string;
  precision?: number;
  /** Sources behind the personal band (normally the personal layer's sourceIds). */
  sourceIds: readonly string[];
  preflightBand?: ChartBand;
  spaceBand?: ChartBand;
  referenceLines?: readonly ChartReferenceLine[];
  events?: readonly ChartEvent[];
  height?: number;
}

const AXIS_TICK = { fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' };

/** Recharts line + personal band + pre-flight dashed band + space-expected band + markers, with a data table. */
export function BandChart(props: BandChartProps) {
  const {
    series,
    title,
    unit,
    precision,
    sourceIds,
    preflightBand,
    spaceBand,
    referenceLines = [],
    events = [],
    height = 220,
  } = props;
  const [showTable, setShowTable] = useState(false);
  const reduced = useReducedMotionPreference();
  const tableId = useId();
  const data = series.map((p) => ({ ...p, band: [p.lo, p.hi] as [number, number] }));
  const sym = unitSymbol(unit);
  const first = series[0]?.missionDay;
  const last = series[series.length - 1]?.missionDay;

  return (
    <figure className="flex flex-col gap-3" aria-label={title}>
      <div aria-hidden="true" className="w-full" style={{ height }}>
        <ComposedChart
          responsive
          accessibilityLayer={false}
          data={data}
          margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
          style={{ width: '100%', height }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="missionDay"
            type="number"
            domain={[first ?? 'dataMin', last ?? 'dataMax']}
            tickFormatter={(d: number) => (d === 0 ? 'Launch' : missionDayLabel(d))}
            tick={AXIS_TICK}
            stroke="var(--border-strong)"
            tickLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={AXIS_TICK}
            stroke="var(--border-strong)"
            tickLine={false}
            width={36}
            label={
              sym
                ? {
                    value: sym,
                    position: 'insideTopLeft',
                    offset: 0,
                    dy: -12,
                    fill: 'var(--text-3)',
                    fontSize: 11,
                  }
                : undefined
            }
          />
          {preflightBand && (
            <ReferenceArea
              y1={preflightBand.lo}
              y2={preflightBand.hi}
              x1={preflightBand.fromDay}
              x2={preflightBand.toDay}
              fill="transparent"
              stroke="var(--text-3)"
              strokeDasharray="5 4"
              ifOverflow="extendDomain"
            />
          )}
          {spaceBand && (
            <ReferenceArea
              y1={spaceBand.lo}
              y2={spaceBand.hi}
              x1={spaceBand.fromDay}
              x2={spaceBand.toDay}
              fill="var(--info)"
              fillOpacity={0.1}
              stroke="none"
              ifOverflow="extendDomain"
            />
          )}
          <Area
            type="stepAfter"
            dataKey="band"
            stroke="none"
            fill="var(--text-3)"
            fillOpacity={0.18}
            isAnimationActive={!reduced}
            animationDuration={250}
            activeDot={false}
          />
          {referenceLines.map((r) => (
            <ReferenceLine
              key={r.label}
              y={r.y}
              stroke={TONE_VAR[r.tone ?? 'muted']}
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />
          ))}
          {events.map((e) => (
            <ReferenceLine
              key={`${e.missionDay}-${e.label}`}
              x={e.missionDay}
              stroke={TONE_VAR[e.tone ?? 'muted']}
              label={{ value: e.label, position: 'insideTopLeft', fill: 'var(--text-2)', fontSize: 11 }}
            />
          ))}
          <Line
            dataKey="value"
            stroke="var(--text-2)"
            strokeWidth={1.75}
            isAnimationActive={!reduced}
            animationDuration={250}
            dot={(p: {
              cx?: number;
              cy?: number;
              index?: number;
              payload?: { state?: keyof typeof VERDICT };
            }) => (
              <circle
                key={p.index}
                cx={p.cx}
                cy={p.cy}
                r={3}
                fill={p.payload?.state ? TONE_VAR[VERDICT[p.payload.state].tone] : 'var(--text-2)'}
                stroke="var(--surface-1)"
                strokeWidth={1}
              />
            )}
            activeDot={{ r: 5, fill: 'var(--brand)', stroke: 'var(--surface-1)' }}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)' }}
            contentStyle={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
            labelFormatter={(d) => missionDayLabel(Number(d))}
            formatter={(v, name) => [
              Array.isArray(v) ? v.join(' – ') : String(v),
              name === 'band' ? 'Personal band' : 'Value',
            ]}
          />
        </ComposedChart>
      </div>
      <figcaption className="flex flex-col gap-2 text-xs text-text-2">
        <BandChartLegend
          sourceIds={sourceIds}
          unit={unit}
          precision={precision}
          preflightBand={preflightBand}
          spaceBand={spaceBand}
          referenceLines={referenceLines}
        />
        <div>
          <Button
            variant="ghost"
            icon={Table2}
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? 'Hide data' : 'View data'}
          </Button>
        </div>
      </figcaption>
      {showTable && (
        <BandChartTable
          id={tableId}
          title={title}
          series={series}
          unit={unit}
          precision={precision}
          sourceIds={sourceIds}
        />
      )}
    </figure>
  );
}
