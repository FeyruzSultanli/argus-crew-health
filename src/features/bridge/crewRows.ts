// Crew-at-a-glance row model and ordering (FR-CREW-3: sorted by severity). Pure.
import type { Assessment, CrewMember, Verdict } from '../../domain/types';
import { VERDICT } from '../../ui/tone';

export interface CrewRowModel {
  member: CrewMember;
  assessments: readonly Assessment[];
  verdict: Verdict;
}

/** Sort by severity of the worst verdict (ACT first), then by number of flags, then by name. */
export function sortCrewRows(rows: CrewRowModel[]): CrewRowModel[] {
  return [...rows].sort(
    (a, b) =>
      VERDICT[b.verdict].severity - VERDICT[a.verdict].severity ||
      flagCount(b.assessments) - flagCount(a.assessments) ||
      a.member.displayName.localeCompare(b.member.displayName),
  );
}

const flagCount = (list: readonly Assessment[]) =>
  list.filter((a) => a.verdict === 'WATCH' || a.verdict === 'ACT').length;
