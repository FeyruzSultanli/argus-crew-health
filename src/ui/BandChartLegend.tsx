import { SourceBadge } from './SourceBadge';
import { TONE_VAR } from './tone';
import type { Tone } from './tone';
import { Value } from './Value';

export interface ChartBand {
  lo: number;
  hi: number;
  sourceIds: readonly string[];
  /** Limit the band to a day range (e.g. pre-flight days only). */
  fromDay?: number;
  toDay?: number;
}

export interface ChartReferenceLine {
  y: number;
  label: string;
  sourceIds: readonly string[];
  tone?: Tone;
}

export interface ChartEvent {
  missionDay: number;
  label: string;
  tone?: Tone;
}

export interface BandChartLegendProps {
  sourceIds: readonly string[];
  unit?: string;
  precision?: number;
  preflightBand?: ChartBand;
  spaceBand?: ChartBand;
  referenceLines: readonly ChartReferenceLine[];
}

/** Legend under a BandChart: every band and reference line with its numbers and source badges. */
export function BandChartLegend({
  sourceIds,
  unit,
  precision,
  preflightBand,
  spaceBand,
  referenceLines,
}: BandChartLegendProps) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <li className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-5 rounded-[3px] bg-text-3/30" />
        Personal band (reference ± 2σ)
        <SourceBadge sourceIds={sourceIds} title="Personal band" />
      </li>
      {preflightBand && (
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-5 rounded-[3px] border border-dashed border-text-3" />
          Pre-flight band
          <Value
            value={preflightBand.lo}
            unit={unit}
            precision={precision}
            sourceIds={preflightBand.sourceIds}
            size="sm"
          />
          –
          <Value
            value={preflightBand.hi}
            unit={unit}
            precision={precision}
            sourceIds={preflightBand.sourceIds}
            size="sm"
          />
        </li>
      )}
      {spaceBand && (
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-5 rounded-[3px] bg-info/20" />
          Space-expected band
          <Value
            value={spaceBand.lo}
            unit={unit}
            precision={precision}
            sourceIds={spaceBand.sourceIds}
            size="sm"
          />
          –
          <Value
            value={spaceBand.hi}
            unit={unit}
            precision={precision}
            sourceIds={spaceBand.sourceIds}
            size="sm"
          />
        </li>
      )}
      {referenceLines.map((r) => (
        <li key={r.label} className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0 w-5 border-t border-dashed"
            style={{ borderColor: TONE_VAR[r.tone ?? 'muted'] }}
          />
          {r.label}
          <Value value={r.y} unit={unit} precision={precision} sourceIds={r.sourceIds} size="sm" />
        </li>
      ))}
    </ul>
  );
}
