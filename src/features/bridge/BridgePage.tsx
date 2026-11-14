import { Stethoscope } from 'lucide-react';

import { useAllAssessments, useAssessments } from '../../services/hooks';
import { useMissionProfile, useMissionStore } from '../../state/mission';
import { missionDayLabel, missionDayText } from '../../state/missionSelectors';
import { ROLE_LABEL, useSessionStore } from '../../state/session';
import { EmptyState, LinkButton } from '../../ui';
import { BridgeBody } from './BridgeBody';

function CrewBridge({ crewId, missionDay }: { crewId: string; missionDay: number }) {
  const own = useAssessments(crewId, missionDay);
  return (
    <BridgeBody
      crewId={crewId}
      cmo={false}
      byCrew={own ? { [crewId]: own } : undefined}
      missionDay={missionDay}
      roleLabel={ROLE_LABEL.crew}
    />
  );
}

function CmoBridge({ crewId, missionDay }: { crewId: string; missionDay: number }) {
  const all = useAllAssessments(missionDay);
  return <BridgeBody crewId={crewId} cmo byCrew={all} missionDay={missionDay} roleLabel={ROLE_LABEL.cmo} />;
}

/** Flight surgeon (FR-CREW-2): only data received over the Earth link — no crew data on the Bridge. */
function SurgeonNotice() {
  return (
    <div className="mx-auto max-w-2xl">
      <EmptyState
        icon={Stethoscope}
        title="The flight surgeon view shows only data received over the Earth link"
        body="Crew health data reaches Earth in packets the crew sends, after the one-way delay. Open the Earth link to see what has arrived."
        action={
          <LinkButton to="/earth" variant="primary">
            Open Earth link
          </LinkButton>
        }
      />
    </div>
  );
}

/** Mission Bridge (doc 11 §5.1): status, today's plan, crew at a glance (CMO), cabin, space weather, Earth link. */
export default function BridgePage() {
  const role = useSessionStore((s) => s.role);
  const crewId = useSessionStore((s) => s.crewId);
  const missionDay = useMissionStore((s) => s.missionDay);
  const profile = useMissionProfile();
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 lg:px-6" data-testid="bridge">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-text">Mission Bridge</h1>
        <p className="font-mono text-xs tracking-wider text-text-2 uppercase" data-testid="bridge-context">
          {profile.label} · <span aria-hidden="true">{missionDayLabel(missionDay)}</span>
          <span className="sr-only">{missionDayText(missionDay)}</span>
        </p>
      </header>
      {role === 'surgeon' || !crewId ? (
        <SurgeonNotice />
      ) : role === 'cmo' ? (
        <CmoBridge crewId={crewId} missionDay={missionDay} />
      ) : (
        <CrewBridge crewId={crewId} missionDay={missionDay} />
      )}
    </div>
  );
}
