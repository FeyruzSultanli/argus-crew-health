import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Send } from 'lucide-react';

import type { CrewMember } from '../../domain/types';
import type { EarthLinkEvent } from '../../services/adapters/earthLinkSink';
import { useCrew, useEarthLinkClock, useInbox, usePackets } from '../../services/hooks';
import type { PacketRow } from '../../services/packets';
import { useMissionProfile, useMissionStore } from '../../state/mission';
import { missionDayLabel, missionDayText } from '../../state/missionSelectors';
import { useSessionStore } from '../../state/session';
import type { Role } from '../../state/session';
import { Card, EmptyState, Skeleton, useToast } from '../../ui';
import { Composer } from './Composer';
import { defaultComposer, type ComposerState } from './composerState';
import { ExportButtons } from './ExportButtons';
import { useNow } from './hooks';
import { Inbox } from './Inbox';
import { LinkStatus } from './LinkStatus';
import { PacketCard } from './PacketCard';
import { SurgeonEarthLink } from './SurgeonView';

function PacketList({ packets }: { packets: PacketRow[] }) {
  const now = useNow(250);
  return (
    <div className="flex flex-col gap-3">
      {packets.map((p) => (
        <PacketCard key={p.id} packet={p} now={now} />
      ))}
    </div>
  );
}

function CrewEarthLink({ crew, role, crewId, missionDay }: { crew: CrewMember[]; role: Role; crewId: string | null; missionDay: number }) {
  const [search] = useSearchParams();
  const initial = useMemo(
    () => defaultComposer({ role, ownCrewId: crewId, missionDay, allCrewIds: crew.map((c) => c.id), search }),
    [role, crewId, missionDay, crew, search],
  );
  const [edited, setEdited] = useState<{ base: ComposerState; state: ComposerState } | null>(null);
  // A new query / day / role resets the composer to its defaults.
  const state = edited && edited.base === initial ? edited.state : initial;
  const packets = usePackets();
  const inbox = useInbox();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Composer
          crew={crew}
          canChooseCrew={role === 'cmo'}
          missionDay={missionDay}
          state={state}
          onChange={(s) => setEdited({ base: initial, state: s })}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <Card title="Sent packets" subtitle="Queued → In transit → Delivered" data-testid="sent-packets">
          {packets === undefined ? (
            <Skeleton lines={3} label="Loading packets" />
          ) : packets.length === 0 ? (
            <EmptyState icon={Send} title="No packet sent yet" body="Compose a packet and send it to the flight surgeon." />
          ) : (
            <PacketList packets={packets} />
          )}
        </Card>
        <Inbox replies={inbox} />
        <Card title="Export" subtitle="FR-DATA-2 · FHIR R4 and CSV" data-testid="export-card">
          <ExportButtons crewIds={state.crewIds} fromDay={state.fromDay} toDay={state.toDay} />
        </Card>
      </div>
    </div>
  );
}

const CREW_TOASTS: Record<EarthLinkEvent['type'], string | null> = {
  'packet-delivered': 'Packet delivered to the flight surgeon',
  'reply-delivered': 'New message from Earth',
  'reply-sent': null,
};
const SURGEON_TOASTS: Record<EarthLinkEvent['type'], string | null> = {
  'packet-delivered': 'New packet received from the crew',
  'reply-delivered': 'Your reply reached the crew',
  'reply-sent': null,
};

/** Earth link (doc 11 §5.7, FR-EARTH-1/2/3): crew & CMO compose and send; the flight surgeon sees what arrived. */
export default function EarthLinkPage() {
  const role = useSessionStore((s) => s.role);
  const crewId = useSessionStore((s) => s.crewId);
  const missionDay = useMissionStore((s) => s.missionDay);
  const profile = useMissionProfile();
  const crew = useCrew();
  const toast = useToast();
  const onEvent = useCallback(
    (e: EarthLinkEvent) => {
      const title = (role === 'surgeon' ? SURGEON_TOASTS : CREW_TOASTS)[e.type];
      if (title) toast.show({ title, tone: 'info' });
    },
    [role, toast],
  );
  useEarthLinkClock(onEvent);
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 lg:px-6" data-testid="earth-link">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-text">Earth link</h1>
        <p className="font-mono text-xs tracking-wider text-text-2 uppercase">
          {profile.label} · <span aria-hidden="true">{missionDayLabel(missionDay)}</span>
          <span className="sr-only">{missionDayText(missionDay)}</span> ·{' '}
          {role === 'surgeon' ? 'Flight surgeon on Earth' : 'On board'}
        </p>
      </header>
      <LinkStatus missionDay={missionDay} />
      {role === 'surgeon' ? (
        <SurgeonEarthLink />
      ) : crew === undefined || role === null ? (
        <Skeleton lines={6} label="Loading crew" />
      ) : (
        <CrewEarthLink crew={crew} role={role} crewId={crewId} missionDay={missionDay} />
      )}
    </div>
  );
}
