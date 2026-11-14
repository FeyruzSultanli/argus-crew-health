// Comparison block under the PVT result (doc 09 §4 last bullet): speed vs personal band, lapses vs baseline,
// sleep last night, verdict and suggestion. Verdict, band and suggestion come from the domain via labData; the
// suggestion is `assessment.action.text` verbatim. Nothing here invents a threshold or advice.
import type { Observation } from '../../../domain/types';
import { median } from '../../../measurement/pvt';
import { useObservations } from '../../../services/hooks';
import { Card } from '../../../ui/Card';
import { LayerTriad } from '../../../ui/LayerTriad';
import { Sparkline } from '../../../ui/Sparkline';
import { StatusPill } from '../../../ui/StatusPill';
import { Value } from '../../../ui/Value';
import { freshnessOf } from '../freshness';
import { useAssessments, usePersonalSeries } from '../labData';
import { readingSourceIds } from '../provenance';

export const VERDICT_PENDING = 'Verdict appears once the reading is evaluated.';

export interface PvtEvaluationProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  /** The run has been saved (the verdict is shown only for a saved reading of today). */
  saved: boolean;
}

const recordLabel = (o: Observation) => o.source.label;

export function PvtEvaluation({ crewId, crewName, missionDay, saved }: PvtEvaluationProps) {
  const runs = useObservations({ crewId, signalId: 'reaction_test' });
  const sleeps = useObservations({ crewId, signalId: 'sleep_duration', toDay: missionDay });
  const series = usePersonalSeries(crewId, 'reaction_test', missionDay);
  const assessment = useAssessments(crewId, missionDay)?.find((a) => a.signalId === 'reaction_test');

  // Baseline lapses = median lapses of the pre-flight runs (doc 07 §4.9) — arithmetic on the record only.
  const preflight = (runs ?? []).filter((o) => o.missionDay <= -1 && typeof o.components?.lapses === 'number');
  const baselineLapses = median(preflight.map((o) => o.components?.lapses as number));
  const lastSleep = sleeps?.[sleeps.length - 1];
  const current = saved && assessment && assessment.missionDay === missionDay && assessment.latest?.missionDay === missionDay;

  return (
    <Card title={`Compared with ${crewName}'s simulated baseline`} headingLevel={3}>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-sm text-text-2">Speed vs personal band</p>
          {series && series.length > 0 ? (
            <Sparkline
              points={series}
              width={200}
              height={48}
              ariaLabel={`Mean response speed, ${series.length} days, with ${crewName}'s personal band`}
            />
          ) : (
            <p className="mt-1 text-sm text-text-3">The personal band appears once the reading is evaluated.</p>
          )}
        </div>
        <div>
          <p className="text-sm text-text-2">Pre-flight baseline lapses</p>
          {baselineLapses === null ? (
            <p className="mt-1 text-sm text-text-3">No pre-flight runs on record.</p>
          ) : (
            <p className="mt-1" data-testid="pvt-baseline-lapses">
              <Value value={baselineLapses} precision={0} sourceIds={preflight[0] ? readingSourceIds(preflight[0]) : []} label={preflight[0] ? recordLabel(preflight[0]) : undefined} title="Median lapses of pre-flight runs" />{' '}
              <span className="text-xs text-text-3">median of {preflight.length} runs</span>
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-text-2">Sleep last night</p>
          {lastSleep ? (
            <Value
              value={lastSleep.value}
              unit="h"
              precision={1}
              sourceIds={readingSourceIds(lastSleep)}
              label={recordLabel(lastSleep)}
              freshness={freshnessOf(lastSleep, missionDay)}
              title="Sleep duration"
            />
          ) : (
            <p className="mt-1 text-sm text-text-3">No sleep entry on record.</p>
          )}
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-4" aria-live="polite">
        {current && assessment ? (
          <div className="flex flex-col gap-3" data-testid="pvt-verdict">
            <StatusPill verdict={assessment.verdict} showMeaning />
            <LayerTriad layers={assessment.layers} drivenBy={assessment.drivenBy} caughtOnlyByPersonal={assessment.caughtOnlyByPersonal} variant="expanded" />
            {assessment.action.kind !== 'none' && (
              <p className="text-sm text-text" data-testid="pvt-action">
                {assessment.action.text}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-2" data-testid="pvt-verdict-pending">
            {VERDICT_PENDING}
          </p>
        )}
      </div>
    </Card>
  );
}
