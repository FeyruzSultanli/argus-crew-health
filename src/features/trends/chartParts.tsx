// SVG pieces of the Trends chart: point markers (simulated circle, measured square, WATCH / ACT verdict glyphs)
// and the tooltip. Shapes and words carry the meaning, never colour alone (doc 11 §1.2).
import type { Verdict } from '../../domain/types';
import { missionDayLabel } from '../../state/missionSelectors';
import { useUiStore } from '../../state/ui';
import { TONE_VAR, VERDICT } from '../../ui/tone';
import { formatNumber, toDisplayUnit, unitSymbol } from '../../ui/units';
import { indexToDay } from './axis';
import type { ChartRow } from './chartRows';
import type { TrendTrack } from './trendData';

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: ChartRow;
}

/** Dot of track i: verdict glyph on WATCH / ACT days, square for a user reading, circle otherwise. */
export function TrendDot({ cx, cy, index, payload, i, stroke }: DotProps & { i: number; stroke: string }) {
  {
    if (cx === undefined || cy === undefined || !payload || payload[`v${i}`] === undefined)
      return <g key={index} />;
    const day = indexToDay(payload.x);
    const state = payload[`s${i}`] as Verdict | undefined;
    const measured = payload[`m${i}`] === true;
    if (state === 'ACT') {
      return (
        <g key={index} data-testid={`marker-act-${day}`} data-track={i}>
          <title>{`${missionDayLabel(day)}: Act`}</title>
          <path
            d={`M ${cx} ${cy - 8} L ${cx + 7} ${cy + 5} L ${cx - 7} ${cy + 5} Z`}
            fill={TONE_VAR.act}
            stroke="var(--surface-1)"
            strokeWidth={1.5}
          />
        </g>
      );
    }
    if (state === 'WATCH') {
      return (
        <g key={index} data-testid={`marker-watch-${day}`} data-track={i}>
          <title>{`${missionDayLabel(day)}: Watch`}</title>
          <path
            d={`M ${cx} ${cy - 6} L ${cx + 6} ${cy} L ${cx} ${cy + 6} L ${cx - 6} ${cy} Z`}
            fill="var(--surface-1)"
            stroke={TONE_VAR.watch}
            strokeWidth={2}
          />
        </g>
      );
    }
    if (measured) {
      return (
        <rect
          key={index}
          data-testid={`measured-${day}`}
          x={cx - 4}
          y={cy - 4}
          width={8}
          height={8}
          fill="var(--brand)"
          stroke="var(--surface-1)"
          strokeWidth={1}
        />
      );
    }
    return (
      <circle key={index} cx={cx} cy={cy} r={2.5} fill={stroke} stroke="var(--surface-1)" strokeWidth={1} />
    );
  }
}

interface TooltipContentProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartRow }>;
  label?: number | string;
  tracks: readonly TrendTrack[];
  overlays: ReadonlyArray<{ key: string; label: string }>;
  unit: string;
  precision: number;
}

/** Tooltip: day, each track's value (+ band and verdict word), data label; overlays by crew name. */
export function TrendTooltip({ active, payload, tracks, overlays, unit, precision }: TooltipContentProps) {
  const prefs = useUiStore((s) => s.units);
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const fmt = (v: number) => {
    const d = toDisplayUnit(v, unit, prefs);
    return `${formatNumber(d.value, precision)} ${unitSymbol(d.unit)}`.trim();
  };
  return (
    <div className="rounded-control border border-border-strong bg-surface-2 px-3 py-2 font-mono text-xs text-text shadow-overlay">
      <p className="mb-1 text-text-2">{missionDayLabel(indexToDay(row.x))}</p>
      {tracks.map((t, i) => {
        const v = row[`v${i}`];
        if (typeof v !== 'number') return null;
        const band = row[`b${i}`];
        const state = row[`s${i}`] as Verdict | undefined;
        return (
          <p key={t.key}>
            {tracks.length > 1 ? `${t.label}: ` : ''}
            {fmt(v)}
            {Array.isArray(band) ? ` (band ${fmt(band[0])} – ${fmt(band[1])})` : ''}
            {state ? ` · ${VERDICT[state].word}` : ''}
            {row[`m${i}`] === true ? ' · MEASURED' : ' · SIMULATED'}
          </p>
        );
      })}
      {overlays.map((o) => {
        const v = row[`o_${o.key}`];
        return typeof v === 'number' ? (
          <p key={o.key} className="text-text-2">
            {o.label}: {fmt(v)}
          </p>
        ) : null;
      })}
    </div>
  );
}
