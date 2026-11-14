import type { PersonalResult, SignalDef } from '../../domain/types';
import { useMissionProfile } from '../../state/mission';
import { BandChart } from '../../ui/BandChart';
import { TREND_WINDOW_DAYS, spaceExpectedBand, trendWindow } from './cardHelpers';

export interface SignalTrendProps {
  def: SignalDef;
  series: PersonalResult['series'] | undefined;
  missionDay: number;
  unit?: string;
  personalSourceIds: readonly string[];
}

/** BandChart of the last 30 days with the personal band (and the space-expected band where defined). */
export function SignalTrend({ def, series, missionDay, unit, personalSourceIds }: SignalTrendProps) {
  const profile = useMissionProfile();
  if (series === undefined) return <p className="text-sm text-text-3">Loading trend…</p>;
  const window = trendWindow(series, missionDay);
  if (window.length === 0) {
    return (
      <p className="text-sm text-text-2">No personal-band readings in the last {TREND_WINDOW_DAYS} days.</p>
    );
  }
  const shift = def.personal.expectedShift?.({ missionDay, profile }) ?? 0;
  return (
    <BandChart
      title={`${def.label} vs your personal band, last ${TREND_WINDOW_DAYS} days`}
      series={window}
      unit={unit}
      sourceIds={personalSourceIds.length > 0 ? personalSourceIds : ['SRC_DEMO_BASELINE_ENGINE']}
      spaceBand={spaceExpectedBand(def, series, shift, window)}
      height={180}
    />
  );
}
