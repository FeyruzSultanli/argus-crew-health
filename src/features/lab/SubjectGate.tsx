// Shared front door of every Lab flow route (doc 09 intro): CMO without a selection → "Who is being measured?";
// flight surgeon (or signed out) → read-only notice; otherwise the flow for `subject.crewId`.
import type { ReactNode } from 'react';
import { UserRound } from 'lucide-react';

import { useUiStore } from '../../state/ui';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { SEED_ROSTER } from './subject';
import type { LabSubject } from './subject';
import { SurgeonNotice } from './SurgeonNotice';

export function SubjectGate({
  subject,
  title,
  children,
}: {
  subject: LabSubject;
  /** The flow's h1 (kept on the picker so the page keeps its name). */
  title: string;
  children: (crewId: string) => ReactNode;
}) {
  const setSelected = useUiStore((s) => s.setSelectedCrew);
  if (subject.crewId) return <>{children(subject.crewId)}</>;
  if (!subject.needsPick) return <SurgeonNotice />;
  return (
    <section aria-labelledby="lab-pick-title" className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 id="lab-pick-title" className="mb-4 text-2xl font-semibold">
        {title}
      </h1>
      <Card
        title="Who is being measured?"
        subtitle="The CMO picks the crew member first; the reading is saved to their record."
      >
        {/* seed/crew.json while the record is loading: the same fictional crew */}
        <ul className="grid gap-3 sm:grid-cols-2">
          {(subject.roster ?? SEED_ROSTER).map((c) => (
            <li key={c.id}>
              <Button icon={UserRound} className="w-full justify-start" onClick={() => setSelected(c.id)}>
                <span className="font-semibold">{c.displayName}</span>
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/** "Change" next to the subject chip (CMO only): back to the picker. */
export function ChangeSubjectButton({ subject }: { subject: LabSubject }) {
  const setSelected = useUiStore((s) => s.setSelectedCrew);
  if (subject.role !== 'cmo') return null;
  return (
    <Button variant="ghost" onClick={() => setSelected(null)}>
      Change
    </Button>
  );
}
