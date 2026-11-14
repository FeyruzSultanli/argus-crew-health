// Dose ledger per crew (doc 10 §4, doc 11 §5.5 row 2). Dose equivalent from published measurements vs the
// NASA-STD-3001 600 mSv career limit. Crew see their own row, the CMO all rows (crew data; not for the surgeon role).
import type { CrewMember, DoseLedger, MissionProfile } from '../../domain/types';
import { ALARA_NOTE, CAREER_LIMIT_MSV, LEDGER_QUANTITY_LABEL } from '../../domain/radiation/doseLedger';
import { MODELED_LABEL } from '../../domain/radiation/speDose';
import { Card, SourceBadge, Value } from '../../ui';
import { DoseLedgerRow } from './DoseLedgerRow';

export interface DoseLedgerCardProps {
  ledgers: DoseLedger[];
  crew: readonly CrewMember[];
  profile: MissionProfile;
  missionDay: number;
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block h-3 w-4 rounded-[2px] ${className}`} />
      {label}
    </span>
  );
}

export function DoseLedgerCard({ ledgers, crew, profile, missionDay }: DoseLedgerCardProps) {
  const scale = Math.max(650, ...ledgers.map((l) => l.projectedEndMsv + 20));
  const names = new Map(crew.map((c) => [c.id, c.displayName]));
  return (
    <Card
      title="Dose ledger"
      subtitle={LEDGER_QUANTITY_LABEL}
      actions={<SourceBadge sourceIds={['SRC_STD3001_RAD']} title="NASA-STD-3001 career limit (V1 4030)" />}
      data-testid="dose-ledger"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-2">
          <Swatch className="bg-text-3" label="Career pre-mission (simulated)" />
          <Swatch className="bg-text-2" label="Mission GCR" />
          <Swatch className="bg-text" label="Mission SPE (modeled)" />
          <Swatch className="border border-dashed border-text-3" label="Projected end of mission" />
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-act" />
            Career limit
            <Value
              value={CAREER_LIMIT_MSV}
              unit="mSv"
              sourceIds={['SRC_STD3001_RAD']}
              size="sm"
              title="Career limit"
            />
          </span>
        </div>
        <p className="text-xs text-text-2">
          Cosmic-ray rate for {profile.label}:{' '}
          <Value
            value={profile.gcrDoseMsvPerDay}
            unit="mSv/d"
            precision={2}
            sourceIds={profile.sourceIds}
            size="sm"
            title="Baseline GCR dose rate"
          />{' '}
          ·{' '}
          {missionDay < 1
            ? 'pre-flight: no mission days counted yet; mission length '
            : 'mission days counted '}
          {missionDay >= 1 && (
            <>
              <Value
                value={Math.min(missionDay, profile.durationDays)}
                unit="d"
                sourceIds={profile.sourceIds}
                size="sm"
                title="Mission days counted"
              />{' '}
              of{' '}
            </>
          )}
          <Value
            value={profile.durationDays}
            unit="d"
            sourceIds={profile.sourceIds}
            size="sm"
            title="Mission length"
          />
          . Projection = dose so far + remaining days × rate.
        </p>
        <p className="text-sm text-watch-fg" data-testid="ledger-modeled-label">
          {MODELED_LABEL}
        </p>
        <p className="text-xs text-text-2">
          Modeled SPE dose covers events in the displayed window. Totals and projections that include it are
          marked “includes modeled SPE dose”.
        </p>
        <ul className="flex flex-col">
          {ledgers.map((l) => (
            <DoseLedgerRow
              key={l.crewId}
              ledger={l}
              name={names.get(l.crewId) ?? l.crewId}
              missionDay={missionDay}
              scaleMsv={scale}
              gcrSourceIds={profile.sourceIds}
            />
          ))}
        </ul>
        <p className="text-sm text-text" data-testid="alara-note">
          {ALARA_NOTE}
        </p>
      </div>
    </Card>
  );
}
