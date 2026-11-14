import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { UserX, Wind } from 'lucide-react';

import type { BodyRegionId, SignalId } from '../../domain/types';
import { useMissionStore } from '../../state/mission';
import { useSessionStore } from '../../state/session';
import { useUiStore } from '../../state/ui';
import { LinkButton } from '../../ui/Button';
import { EmptyState } from '../../ui/States';
import { useAllAssessments, useAssessments } from './bodyData';
import { BodyStage } from './BodyStage';
import type { CameraInput, CameraRequest } from './BodyViewport';
import { BODY_CREW, crewById } from './crew';
import { buildHotspots } from './hotspots';
import { LeftRail } from './LeftRail';
import { OrganCard } from './OrganCard';
import { primaryRegion, worstSignalInRegion } from './regions';
import { SignalPanel } from './SignalPanel';
import { ANCHORS } from './svgLayout';
import type { ViewMode } from './StageToolbar';
import { webglAvailable } from './webgl';

/** Body — 3D crew health (doc 11 §5.2): left rail, centre body, right signal panel. */
export default function BodyPage() {
  const params = useParams();
  const role = useSessionStore((s) => s.role);
  const ownId = useSessionStore((s) => s.crewId);
  const subjectId = params.crewId ?? ownId ?? BODY_CREW[0]?.id ?? 'c1';
  const member = crewById(subjectId);
  const isCabin = subjectId === 'cabin';

  const missionDay = useMissionStore((s) => s.missionDay);
  const lens = useUiStore((s) => s.layerLens);
  const setLens = useUiStore((s) => s.setLayerLens);
  const filter = useUiStore((s) => s.bodySystemFilter);
  const setFilter = useUiStore((s) => s.setBodySystemFilter);
  const selectedSignalId = useUiStore((s) => s.selectedSignalId);
  const setSelectedSignal = useUiStore((s) => s.setSelectedSignal);
  const setSelectedCrew = useUiStore((s) => s.setSelectedCrew);

  const assessments = useAssessments(subjectId, missionDay);
  const all = useAllAssessments(missionDay);
  const visibleCrew = useMemo(
    () => (role === 'crew' ? BODY_CREW.filter((c) => c.id === ownId) : BODY_CREW),
    [role, ownId],
  );

  const [region, setRegion] = useState<BodyRegionId | null>(null);
  const [organ, setOrgan] = useState<BodyRegionId | null>(null);
  const [scrollSeq, setScrollSeq] = useState(0);
  const [camera, setCamera] = useState<CameraRequest>({ kind: 'home', seq: 0 });
  const [view, setView] = useState<ViewMode>(() => (webglAvailable() ? '3d' : '2d'));
  const requestCamera = (r: CameraInput) => setCamera((c) => ({ ...r, seq: c.seq + 1 }) as CameraRequest);

  // New subject: clear the local region during render (no effect cascade); the store selection in an effect.
  const [prevSubject, setPrevSubject] = useState(subjectId);
  if (prevSubject !== subjectId) {
    setPrevSubject(subjectId);
    setRegion(null);
    setOrgan(null);
  }
  useEffect(() => {
    setSelectedCrew(subjectId);
    setSelectedSignal(null);
  }, [subjectId, setSelectedCrew, setSelectedSignal]);

  const hotspots = useMemo(
    () => buildHotspots(assessments ?? [], lens, filter, region),
    [assessments, lens, filter, region],
  );

  /** Card expanded/collapsed: fly to its region and pulse the hotspot. */
  const selectSignal = (id: SignalId | null) => {
    setSelectedSignal(id);
    const r = id ? primaryRegion(id) : undefined;
    setRegion(r ?? null);
    if (r) requestCamera({ kind: 'region', region: r });
  };

  /** Hotspot / organ clicked: open the region's worst signal under the current lens. */
  const selectRegion = (r: BodyRegionId) => {
    setRegion(r);
    setOrgan(r);
    requestCamera({ kind: 'region', region: r });
    const sig = worstSignalInRegion(assessments ?? [], r, lens);
    if (sig) {
      setSelectedSignal(sig);
      setScrollSeq((n) => n + 1);
    }
  };

  if (!member && !isCabin) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState
          icon={UserX}
          title="Unknown crew member"
          body={`There is no crew member with the id "${subjectId}".`}
          action={<LinkButton to="/body">Back to the body view</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_400px] grid-rows-[auto_minmax(520px,calc(100dvh-7.5rem))] xl:h-[calc(100dvh-7.5rem)] xl:min-h-[600px] xl:grid-cols-[280px_minmax(0,1fr)_420px] xl:grid-rows-1"
      data-testid="body-page"
      data-lens={lens}
    >
      <div className="col-span-2 min-h-0 xl:col-span-1">
        <LeftRail
          crew={visibleCrew}
          all={all}
          selectedId={subjectId}
          lens={lens}
          onLensChange={setLens}
          missionDay={missionDay}
        />
      </div>
      {member ? (
        <BodyStage
          member={member}
          assessments={assessments ?? []}
          hotspots={hotspots}
          onRegion={selectRegion}
          camera={camera}
          onCamera={requestCamera}
          view={view}
          onViewChange={setView}
          webglAvailable={webglAvailable()}
          filter={filter}
          onFilter={setFilter}
          missionDay={missionDay}
          overlay={
            organ && (
              <OrganCard
                region={organ}
                assessments={assessments ?? []}
                lens={lens}
                onSignal={(id) => {
                  selectSignal(id);
                  setScrollSeq((n) => n + 1);
                }}
                onClose={() => setOrgan(null)}
                side={view === '2d' && ANCHORS[organ].side === 'L' ? 'right' : 'left'}
              />
            )
          }
        />
      ) : (
        <section aria-labelledby="body-subject" className="flex flex-col gap-4 p-4">
          <h1 id="body-subject" className="text-2xl font-semibold text-text">
            Cabin
          </h1>
          <EmptyState
            icon={Wind}
            title="Cabin signals have no body region"
            body="Cabin air readings are listed on the right. The Environment screen shows their trends."
            action={<LinkButton to="/environment">Open Environment</LinkButton>}
          />
        </section>
      )}
      <SignalPanel
        assessments={assessments}
        selectedSignalId={selectedSignalId}
        onSelect={selectSignal}
        scrollSeq={scrollSeq}
        className="min-h-0 overflow-y-auto border-l border-border"
      />
    </div>
  );
}
