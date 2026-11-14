// Read-only explanation for roles that do not measure in the Lab (doc 05 §7: Lab is for crew and CMO).
import { Info } from 'lucide-react';

import { EmptyState } from '../../ui/States';

export function SurgeonNotice() {
  return (
    <EmptyState
      icon={Info}
      title="The Measurement Lab is used on board"
      body="Crew members and the Crew Medical Officer take measurements here. The flight surgeon sees the results that arrive through the Earth link."
    />
  );
}
