// Measurement subject (doc 09 intro): the CMO picks one of the four first; a crew member measures themself.
import { useUiStore } from '../../../state/ui';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { Skeleton } from '../../../ui/States';
import { SubjectChip } from '../SubjectChip';
import type { LabSubject } from '../subject';

export function SubjectPicker({ subject }: { subject: LabSubject }) {
  const setSelected = useUiStore((s) => s.setSelectedCrew);
  if (subject.role !== 'cmo') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <SubjectChip name={subject.crewName} />
        <span className="text-sm text-text-2">You measure yourself; the CMO can measure any crew member.</span>
      </div>
    );
  }
  if (!subject.roster) return <Skeleton lines={1} className="w-96" label="Loading crew" />;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span id="lab-subject-label" className="text-sm font-medium text-text">
        Who is being measured?
      </span>
      <SegmentedControl
        label="Measurement subject"
        options={subject.roster.map((c) => ({ value: c.id, label: c.displayName }))}
        value={subject.crewId ?? ''}
        onChange={(id) => setSelected(id)}
      />
      {subject.crewId ? (
        <SubjectChip name={subject.crewName} />
      ) : (
        <span className="text-sm text-text-2" data-testid="lab-subject-pick">
          Pick the crew member first.
        </span>
      )}
    </div>
  );
}
