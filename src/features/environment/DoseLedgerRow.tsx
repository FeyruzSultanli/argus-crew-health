// One crew row of the dose ledger: stacked bar (career pre-mission / mission GCR / mission SPE modeled), 600 mSv
// marker, projected end-of-mission ghost bar, numbers and the radiation_dose verdict (doc 11 §5.5 row 2).
import type { DoseLedger } from '../../domain/types';
import { useAssessments } from '../../services/hooks';
import { StatusPill, Value } from '../../ui';
import { CAREER_LIMIT_MSV } from '../../domain/radiation/doseLedger';

export interface DoseLedgerRowProps {
  ledger: DoseLedger;
  name: string;
  missionDay: number;
  /** Bar scale maximum (mSv). */
  scaleMsv: number;
  gcrSourceIds: readonly string[];
}

/** Visible "modeled" tag next to every modeled number (doc 10 §5; the full sentence is on the ledger card). */
function ModeledTag({ text = 'MODELED' }: { text?: string }) {
  return (
    <span className="rounded-[4px] border border-dashed border-watch-border px-1 font-mono text-[10px] leading-4 tracking-wider text-watch-fg">
      {text}
    </span>
  );
}

const pct = (v: number, max: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;

export function DoseLedgerRow({ ledger: l, name, missionDay, scaleMsv, gcrSourceIds }: DoseLedgerRowProps) {
  const verdict = useAssessments(l.crewId, missionDay)?.find((a) => a.signalId === 'radiation_dose')?.verdict;
  const ids = l.sourceIds;
  const hasSpe = l.missionSpeMsvModeled > 0;
  return (
    <li
      className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0"
      data-testid={`dose-row-${l.crewId}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-text">{name}</span>
        <span className="flex items-center gap-2" data-testid={`dose-verdict-${l.crewId}`}>
          <span className="text-xs text-text-3">Radiation dose</span>
          <StatusPill verdict={verdict ?? 'NO_DATA'} size="sm" />
        </span>
      </div>
      <div className="relative h-5" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0 rounded-[4px] border border-dashed border-text-3"
          style={{ width: pct(l.projectedEndMsv, scaleMsv) }}
        />
        <div
          className="absolute inset-y-1 left-0 flex overflow-hidden rounded-[3px]"
          style={{ width: pct(l.totalMsv, scaleMsv) }}
        >
          <span className="h-full bg-text-3" style={{ width: pct(l.careerPreMissionMsv, l.totalMsv || 1) }} />
          <span className="h-full bg-text-2" style={{ width: pct(l.missionGcrMsv, l.totalMsv || 1) }} />
          {l.missionSpeMsvModeled > 0 && <span className="h-full min-w-[3px] flex-1 bg-text" />}
        </div>
        <div
          className="absolute inset-y-[-4px] w-0.5 bg-act"
          style={{ left: pct(CAREER_LIMIT_MSV, scaleMsv) }}
        />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-2 sm:grid-cols-4">
        <div className="flex flex-col">
          <dt>Career pre-mission</dt>
          <dd>
            <Value
              value={l.careerPreMissionMsv}
              unit="mSv"
              precision={1}
              sourceIds={['SRC_DEMO_SIMULATION']}
              label="SIMULATED"
              size="sm"
              title="Career dose before this mission (simulated crew record)"
            />
          </dd>
        </div>
        <div className="flex flex-col">
          <dt>Mission GCR</dt>
          <dd>
            <Value
              value={l.missionGcrMsv}
              unit="mSv"
              precision={1}
              sourceIds={gcrSourceIds}
              size="sm"
              title="Mission cosmic-ray dose (published daily rate × days)"
            />
          </dd>
        </div>
        <div className="flex flex-col">
          <dt>Mission SPE (modeled — illustrative)</dt>
          <dd className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid={`dose-spe-${l.crewId}`}>
            <Value
              value={l.missionSpeMsvModeled}
              unit="mSv"
              precision={2}
              sourceIds={['SRC_DEMO_RADIATION_MODEL']}
              size="sm"
              title="Modeled solar-event dose — illustrative"
            />
            <ModeledTag />
          </dd>
        </div>
        <div className="flex flex-col">
          <dt>Total · share of career limit</dt>
          <dd className="flex flex-wrap gap-x-2 gap-y-2">
            <Value
              value={l.totalMsv}
              unit="mSv"
              precision={1}
              sourceIds={ids}
              size="sm"
              title="Career dose so far"
            />
            <Value
              value={l.pctOfCareerLimit}
              unit="%"
              precision={1}
              sourceIds={['SRC_STD3001_RAD']}
              size="sm"
              title="Share of the 600 mSv career limit"
            />
            {hasSpe && <ModeledTag text="includes modeled SPE dose" />}
          </dd>
        </div>
        <div className="col-span-2 flex flex-col sm:col-span-4">
          <dt>Projected end of mission</dt>
          <dd className="flex flex-wrap gap-x-2 gap-y-2" data-testid={`dose-projected-${l.crewId}`}>
            <Value
              value={l.projectedEndMsv}
              unit="mSv"
              precision={1}
              sourceIds={ids}
              size="sm"
              title="Projected career dose at the end of the mission"
            />
            <Value
              value={l.pctProjected}
              unit="%"
              precision={0}
              sourceIds={['SRC_STD3001_RAD']}
              size="sm"
              title="Projected share of the 600 mSv career limit"
            />
            {hasSpe && <ModeledTag text="includes modeled SPE dose" />}
          </dd>
        </div>
      </dl>
    </li>
  );
}
