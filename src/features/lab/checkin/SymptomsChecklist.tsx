// Symptoms checklist as large toggle chips (doc 07 §4.17). Checkboxes underneath: Tab moves, Space toggles.
// "No symptoms" is an explicit choice so an empty checklist is never read as "none". No free text, no keywords.
import { Check } from 'lucide-react';

import { SYMPTOM_IDS, SYMPTOM_LABELS, type SymptomId } from './symptoms';

export interface SymptomsChecklistProps {
  value: readonly SymptomId[];
  none: boolean;
  onChange: (value: SymptomId[], none: boolean) => void;
  legend?: string;
}

const chip =
  'flex min-h-target items-center gap-2 rounded-pill border border-border-strong bg-surface-2 px-4 text-sm text-text-2 ' +
  'peer-checked:border-brand peer-checked:bg-bg peer-checked:text-text peer-focus-visible:outline-2 ' +
  'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand';

function Chip({ id, label, checked, onToggle }: { id: string; label: string; checked: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <label className="relative cursor-pointer">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onToggle(e.target.checked)} className="peer absolute inset-0 m-0 opacity-0" />
      <span className={chip}>
        <Check aria-hidden="true" size={16} className={checked ? 'text-brand' : 'opacity-0'} />
        {label}
      </span>
    </label>
  );
}

export function SymptomsChecklist({ value, none, onChange, legend = 'Symptoms today' }: SymptomsChecklistProps) {
  return (
    <div role="group" aria-label={legend} className="flex flex-wrap gap-2">
      {SYMPTOM_IDS.map((id) => (
        <Chip
          key={id}
          id={`symptom-${id}`}
          label={SYMPTOM_LABELS[id]}
          checked={value.includes(id)}
          onToggle={(c) => onChange(c ? [...value, id] : value.filter((s) => s !== id), false)}
        />
      ))}
      <Chip id="symptom-none" label="No symptoms" checked={none} onToggle={(c) => onChange([], c)} />
    </div>
  );
}
