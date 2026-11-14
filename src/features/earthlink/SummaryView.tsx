import type { CrewSummary } from '../../domain/fhir';
import { LAYER_LONG } from '../../domain/fhir';
import { CaughtOnlyByPersonal, StatusPill } from '../../ui';

const dayLabel = (d: number): string => (d < 0 ? `L${d}` : `MD ${d}`);

/** Structured human summary (FR-EARTH-1): built only from assessment fields; text shown verbatim. */
export function SummaryView({ crews, periodDays }: { crews: readonly CrewSummary[]; periodDays: number }) {
  return (
    <div className="flex flex-col gap-4" data-testid="packet-summary">
      {crews.map((c) => {
        const k = c.counts;
        return (
          <section key={c.crewId} className="flex flex-col gap-2" data-testid={`summary-${c.crewId}`} aria-label={`Summary for ${c.name}`}>
            <h3 className="text-sm font-semibold text-text">
              {c.name}{' '}
              <span className="font-normal text-text-2">
                — {k.ACT + k.WATCH} flagged ({k.ACT} Act, {k.WATCH} Watch) · {k.EXPECTED} expected in space · {k.NOMINAL}{' '}
                nominal · {k.NO_DATA} no data · {c.readings} readings in the period
              </span>
            </h3>
            {c.flags.length === 0 && <p className="text-sm text-text-2">No flagged signals.</p>}
            <ul className="flex flex-col gap-3">
              {c.flags.map((f) => (
                <li key={f.signalId} className="flex flex-col gap-1 rounded-control border border-border p-3" data-testid={`flag-${c.crewId}-${f.signalId}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill verdict={f.verdict} size="sm" />
                    <span className="text-sm font-medium text-text">{f.label}</span>
                    {f.drivenBy.length > 0 && (
                      <span className="text-xs text-text-2">driven by {f.drivenBy.map((l) => LAYER_LONG[l]).join(' + ')}</span>
                    )}
                    {f.caughtOnlyByPersonal && <CaughtOnlyByPersonal />}
                  </span>
                  <p className="text-sm text-text">{f.explanation}</p>
                  {f.baseline && <p className="text-xs text-text-2">Against personal baseline: {f.baseline}.</p>}
                  {f.flaggedDays.length > 0 && (
                    <p className="text-xs text-text-2">
                      Flagged on {f.flaggedDays.length} of {periodDays} days in the period ({f.flaggedDays.map(dayLabel).join(', ')}).
                    </p>
                  )}
                  <p className="text-xs text-text-2">Action: {f.actionText}</p>
                </li>
              ))}
            </ul>
            {c.expected.length > 0 && <p className="text-xs text-text-2">Expected in space: {c.expected.join(', ')}.</p>}
            <p className="text-xs text-text-2">
              Data quality:{' '}
              {[
                ...(c.lowQuality.length === 0 ? ['all readings in the period are good quality'] : []),
                ...c.lowQuality.map((l) => `${l.count} ${l.quality} ${l.label} reading${l.count === 1 ? '' : 's'}${l.reasons.length ? ` (${l.reasons.join('; ')})` : ''}`),
                ...(c.stale.length ? [`re-measure due: ${c.stale.join(', ')}`] : []),
                ...(c.noData.length ? [`no recent reading: ${c.noData.join(', ')}`] : []),
              ].join('; ')}
              .
            </p>
          </section>
        );
      })}
    </div>
  );
}
