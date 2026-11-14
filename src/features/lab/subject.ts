// Who is being measured (doc 09 intro "Subject and day quality") — one rule for every Lab route (hub, camera, PVT,
// manual): a crew member always measures themself (FR-CREW-2 "own data"; a stale ui.selectedCrewId from another
// role is ignored); the CMO measures ui.selectedCrewId and, with no selection, picks the crew member first; the
// flight surgeon does not use the Lab (doc 05 §7). The Bridge's quick check-in is a self-report of the signed-in
// person (useSelfSubject). Mission day = mission.missionDay.
import crewJson from '../../../seed/crew.json';
import type { CrewMember } from '../../domain/types';
import { useCrew } from '../../services/hooks';
import { useMissionStore } from '../../state/mission';
import type { Role } from '../../state/session';
import { useSessionStore } from '../../state/session';
import { useUiStore } from '../../state/ui';

export interface CrewOption {
  id: string;
  displayName: string;
}

/** Static roster from seed/crew.json — used while the health record holds no crew yet (not seeded). */
export const SEED_ROSTER: readonly CrewOption[] = crewJson.crew.map((c) => ({ id: c.id, displayName: c.displayName }));

export interface LabSubject {
  role: Role | null;
  /** null while the CMO has not picked anyone yet (`needsPick`) and when nobody can be measured (surgeon). */
  crewId: string | null;
  crewName: string;
  missionDay: number;
  /** Crew list for the CMO's picker; undefined while loading. */
  roster: readonly CrewOption[] | undefined;
  /** CMO without a selection: show the crew picker before any flow. */
  needsPick: boolean;
}

export function rosterOf(crew: readonly CrewMember[] | undefined): readonly CrewOption[] | undefined {
  if (crew === undefined) return undefined;
  return crew.length > 0 ? crew.map((c) => ({ id: c.id, displayName: c.displayName })) : SEED_ROSTER;
}

/** The shared subject rule (pure): crew → self, CMO → the selection (null = pick first), others → nobody. */
export function labSubjectId(role: Role | null, ownId: string | null, selectedId: string | null): string | null {
  if (role === 'crew') return ownId;
  if (role === 'cmo') return selectedId;
  return null;
}

function nameOf(crewId: string | null, roster: readonly CrewOption[] | undefined): string {
  if (!crewId) return '—';
  return (
    (roster ?? SEED_ROSTER).find((c) => c.id === crewId)?.displayName ??
    SEED_ROSTER.find((c) => c.id === crewId)?.displayName ??
    crewId
  );
}

export function useLabSubject(): LabSubject {
  const role = useSessionStore((s) => s.role);
  const ownId = useSessionStore((s) => s.crewId);
  const selected = useUiStore((s) => s.selectedCrewId);
  const missionDay = useMissionStore((s) => s.missionDay);
  const roster = rosterOf(useCrew());
  const crewId = labSubjectId(role, ownId, selected);
  return { role, crewId, crewName: nameOf(crewId, roster), missionDay, roster, needsPick: role === 'cmo' && crewId === null };
}

/** The signed-in crew member's own record (crew or CMO) — for self-reports such as the Bridge check-in. */
export function useSelfSubject(): LabSubject {
  const role = useSessionStore((s) => s.role);
  const ownId = useSessionStore((s) => s.crewId);
  const missionDay = useMissionStore((s) => s.missionDay);
  const roster = rosterOf(useCrew());
  const crewId = role === 'crew' || role === 'cmo' ? ownId : null;
  return { role, crewId, crewName: nameOf(crewId, roster), missionDay, roster, needsPick: false };
}
