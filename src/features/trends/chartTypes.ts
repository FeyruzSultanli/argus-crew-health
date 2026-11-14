// Band / reference-line shapes of the Trends charts. Structurally identical to ui/BandChartLegend's ChartBand and
// ChartReferenceLine; declared here (a .ts module) so the pure modules and the e2e spec do not import a .tsx file.
import type { Tone } from '../../ui/tone';

export interface ChartBand {
  lo: number;
  hi: number;
  sourceIds: readonly string[];
  fromDay?: number;
  toDay?: number;
}

export interface ChartReferenceLine {
  y: number;
  label: string;
  sourceIds: readonly string[];
  tone?: Tone;
}
