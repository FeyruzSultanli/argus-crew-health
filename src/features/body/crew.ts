// Crew list for the Body page. seed/crew.json is the source Dexie is seeded from; reading it directly keeps
// the left rail independent of whether the database has been seeded yet.
import crewJson from '../../../seed/crew.json';
import type { CrewMember } from '../../domain/types';

export const BODY_CREW: readonly CrewMember[] = crewJson.crew as unknown as CrewMember[];

export function crewById(id: string | undefined): CrewMember | undefined {
  return BODY_CREW.find((c) => c.id === id);
}
