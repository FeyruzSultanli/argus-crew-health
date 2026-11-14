import { useCallback, useMemo } from 'react';
import { FlaskConical } from 'lucide-react';

import { weekSummary } from '../../domain/readiness/planHistory';
import type { Assessment } from '../../domain/types';
import { useCrew, useTodayPlan } from '../../services/hooks';
import { useUiStore } from '../../state/ui';
import { Card, EmptyState, LinkButton, Skeleton } from '../../ui';
import { CabinTile } from './CabinTile';
import { countAcrossCrew } from './counters';
import { CrewAtAGlance, CrewAtAGlanceSkeleton } from './CrewAtAGlance';
import { EarthLinkTile } from './EarthLinkTile';
import { HeroStrip } from './HeroStrip';
import { useCrewHistories } from './hooks';
import { QUICK_CHECKIN_ID } from './planLinks';
import { QuickCheckInConnected } from '../lab/checkin/QuickCheckInConnected';
import { SectionBoundary } from './SectionBoundary';
import { SpaceWeatherTileConnected } from './SpaceWeatherTileConnected';
import { TodayPlan } from './TodayPlan';

export interface BridgeBodyProps {
  /** Signed-in crew member (own data). */
  crewId: string;
  /** CMO: also Crew at a glance for every crew member, counters across the crew. */
  cmo: boolean;
  /** Assessments by crew id for the day (crew role: own entry only); undefined while loading. */
  byCrew: Record<string, Assessment[]> | undefined;
  missionDay: number;
  roleLabel: string;
}

function HeroSkeleton() {
  return (
    // About the loaded hero's height (≈ 525 px at 1350 px), so the plan below does not jump (CLS).
    <Card className="min-h-[32rem]">
      <div className="flex gap-5">
        <Skeleton variant="circle" label="Loading your status" />
        <Skeleton lines={3} className="flex-1" />
      </div>
    </Card>
  );
}

/** The Bridge for a crew member or the CMO: a pure function of (role, crew, missionDay). */
export function BridgeBody({ crewId, cmo, byCrew, missionDay, roleLabel }: BridgeBodyProps) {
  const crew = useCrew();
  const tasks = useTodayPlan(crewId, missionDay);
  const setSelectedCrew = useUiStore((s) => s.setSelectedCrew);
  const visibleIds = useMemo(() => (cmo ? (crew ?? []).map((c) => c.id) : [crewId]), [cmo, crew, crewId]);
  const histories = useCrewHistories(visibleIds);
  const me = crew?.find((c) => c.id === crewId);
  const own = byCrew?.[crewId];
  const counts = useMemo(
    () => (byCrew ? countAcrossCrew(byCrew, visibleIds) : undefined),
    [byCrew, visibleIds],
  );
  const crewWeekPoints = useMemo(() => {
    if (!cmo || !histories) return undefined;
    return visibleIds.reduce((s, id) => s + weekSummary(id, histories[id] ?? [], missionDay).points, 0);
  }, [cmo, histories, visibleIds, missionDay]);

  const focusCheckin = useCallback(() => {
    setSelectedCrew(crewId);
    const el = document.getElementById(QUICK_CHECKIN_ID);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    el?.focus();
  }, [crewId, setSelectedCrew]);

  const empty = own !== undefined && own.every((a) => a.verdict === 'NO_DATA');
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
        <SectionBoundary what="Your status">
          {own === undefined || !counts || !crew ? (
            <HeroSkeleton />
          ) : empty ? (
            <EmptyState
              icon={FlaskConical}
              title={`No readings yet for ${me?.displayName ?? 'you'}`}
              body="Take a first measurement to see your status against Personal, Space and Earth."
              action={
                <LinkButton to="/lab" variant="primary">
                  Open the Measurement Lab
                </LinkButton>
              }
            />
          ) : (
            <HeroStrip
              crewId={crewId}
              name={me?.displayName ?? crewId}
              roleLabel={roleLabel}
              assessments={own}
              tasks={tasks}
              counts={counts}
              countsScope={cmo ? `Across ${visibleIds.length} crew today` : 'Your signals today'}
            />
          )}
        </SectionBoundary>
        {cmo && (
          <SectionBoundary what="Crew at a glance">
            {byCrew && crew ? (
              <CrewAtAGlance crew={crew} byCrew={byCrew} missionDay={missionDay} />
            ) : (
              <CrewAtAGlanceSkeleton />
            )}
          </SectionBoundary>
        )}
        <SectionBoundary what="Today's plan">
          <TodayPlan
            crewId={crewId}
            missionDay={missionDay}
            tasks={tasks}
            assessments={own ?? []}
            history={histories?.[crewId]}
            exercisePlanMin={me?.simulatedBaseline.exercise_plan_min}
            crewWeekPoints={crewWeekPoints}
            onFocusCheckin={focusCheckin}
          />
        </SectionBoundary>
      </div>
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
        <SpaceWeatherTileConnected />
        <SectionBoundary what="Cabin">
          <CabinTile missionDay={missionDay} />
        </SectionBoundary>
        <EarthLinkTile missionDay={missionDay} />
        <div
          id={QUICK_CHECKIN_ID}
          tabIndex={-1}
          className="rounded-card outline-none focus:ring-2 focus:ring-brand"
        >
          {/* Keep this wrapper: the plan's "Start" button focuses it. */}
          <QuickCheckInConnected />
        </div>
      </div>
    </div>
  );
}
