import { useEffect, useMemo, useState } from 'react';
import { Satellite, Users } from 'lucide-react';

import { addMissionDays, dateOf } from '../../services/missionClock';
import { useAllAssessments, useCrew, useDeliveredPackets, useEarthLinkClock, useMissionClock } from '../../services/hooks';
import { useMissionProfile, useMissionStore } from '../../state/mission';
import { missionDayLabel, missionDayText } from '../../state/missionSelectors';
import { useSessionStore } from '../../state/session';
import { EmptyState, LinkButton, Skeleton } from '../../ui';
import { CrewCard } from './CrewCard';
import { crewRow, receivedRows, sortCrewRows } from './crewOverview';
import { ReceivedCrewCard } from './ReceivedCrewCard';

const GRID = 'grid gap-4 md:grid-cols-2';

/** Date.now(), refreshed once a minute (for "last measurement" ages). */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function CmoOverview({ missionDay }: { missionDay: number }) {
  const crew = useCrew();
  const all = useAllAssessments(missionDay);
  const clock = useMissionClock();
  const now = useMinuteClock();
  const rows = useMemo(
    () => (crew && all ? sortCrewRows(crew.map((m) => crewRow(m, all[m.id] ?? []))) : undefined),
    [crew, all],
  );
  // Ages are measured from now, or from the end of the selected mission day when scrubbed back.
  const refMs = clock ? Math.min(now, dateOf(addMissionDays(missionDay, 1), clock.missionEpoch).getTime()) : undefined;
  if (!rows) return <Skeleton lines={6} label="Loading crew" />;
  if (rows.length === 0) {
    return <EmptyState icon={Users} title="No crew data" body="The crew list is empty. Reset the demo in Settings." />;
  }
  return (
    <ul className={GRID} aria-label="Crew, most severe first" data-testid="crew-overview">
      {rows.map((r) => (
        <CrewCard key={r.member.id} row={r} missionDay={missionDay} refMs={refMs} />
      ))}
    </ul>
  );
}

function SurgeonOverview() {
  useEarthLinkClock();
  const packets = useDeliveredPackets();
  const rows = useMemo(() => (packets ? receivedRows(packets) : undefined), [packets]);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-2" data-testid="surgeon-scope">
        You see only what delivered Earth-link packets contain: crew members present in a received packet, with values as
        of that packet. Live on-board data is not visible on Earth.
      </p>
      {!rows ? (
        <Skeleton lines={4} label="Loading received packets" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Satellite}
          title="No packet has arrived yet"
          body="Crew members appear here once a packet that contains them has been delivered."
          action={<LinkButton to="/earth">Open Earth link</LinkButton>}
        />
      ) : (
        <ul className={GRID} aria-label="Crew in received packets, most severe first" data-testid="crew-overview">
          {rows.map((r) => (
            <ReceivedCrewCard key={r.crewId} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Crew overview (doc 11 §5.6, FR-CREW-3): CMO sees all crew live; the flight surgeon sees received packets only. */
export default function CrewPage() {
  const role = useSessionStore((s) => s.role);
  const missionDay = useMissionStore((s) => s.missionDay);
  const profile = useMissionProfile();
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 lg:px-6" data-testid="crew-page">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-text">Crew overview</h1>
        <p className="font-mono text-xs tracking-wider text-text-2 uppercase">
          {profile.label} · <span aria-hidden="true">{missionDayLabel(missionDay)}</span>
          <span className="sr-only">{missionDayText(missionDay)}</span> · sorted by severity
        </p>
      </header>
      {role === 'surgeon' ? <SurgeonOverview /> : <CmoOverview missionDay={missionDay} />}
    </div>
  );
}
