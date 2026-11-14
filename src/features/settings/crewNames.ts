// Crew display names from seed/crew.json (static, so the demo controls work before Dexie is seeded).
import crewJson from '../../../seed/crew.json';

const NAMES = new Map<string, string>(crewJson.crew.map((c) => [c.id, c.displayName]));

export function crewName(id: string | null | undefined): string {
  if (!id) return 'No one';
  if (id === 'cabin') return 'Cabin';
  return NAMES.get(id) ?? id;
}
