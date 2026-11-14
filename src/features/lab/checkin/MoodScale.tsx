// Mood 1–5 faces (doc 09 §5), drawn with lucide icons (no emoji). Native radios: arrow keys move, Space selects.
import { Angry, Frown, Laugh, Meh, Smile } from 'lucide-react';

const FACES = [
  { value: 1, Icon: Angry, label: 'Very low' },
  { value: 2, Icon: Frown, label: 'Low' },
  { value: 3, Icon: Meh, label: 'Okay' },
  { value: 4, Icon: Smile, label: 'Good' },
  { value: 5, Icon: Laugh, label: 'Very good' },
] as const;

export interface MoodScaleProps {
  name: string;
  value: number | null;
  onChange: (v: number) => void;
  label?: string;
}

export function MoodScale({ name, value, onChange, label = 'Mood today' }: MoodScaleProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {FACES.map(({ value: v, Icon, label: l }) => (
        <label key={v} className="relative cursor-pointer">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="peer absolute inset-0 m-0 opacity-0" aria-label={`${v} – ${l}`} />
          <span className="flex min-h-16 min-w-16 flex-col items-center justify-center gap-1 rounded-control border border-border-strong bg-surface-2 px-2 py-1 text-text-2 peer-checked:border-brand peer-checked:bg-bg peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
            <Icon aria-hidden="true" size={26} />
            <span className="text-xs">
              {v} · {l}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
