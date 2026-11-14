// Quick check-in (doc 11 §5.1, reused on the Bridge): mood faces + sleep hours + symptom chips + Save.
// Uses the same validation and observation shapes as the manual vitals form. Prop-driven, no store or Dexie access;
// QuickCheckInConnected wires it to the stores and the health service.
import { Save } from 'lucide-react';
import { useState } from 'react';

import type { NewObservation, SignalId, Verdict } from '../../../domain/types';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { ErrorState } from '../../../ui/States';
import { FieldError, NumberField, RangeHint } from '../manual/fields';
import { SavedList } from '../manual/SavedList';
import { SubjectChip } from '../SubjectChip';
import { type SaveOutcome, describeOutcome, saveAll } from '../manual/saveAll';
import { EMPTY_DRAFT, type FieldErrors, VALID_RANGES, validateManualDraft } from '../manual/validation';
import { MoodScale } from './MoodScale';
import type { SymptomId } from './symptoms';
import { SymptomsChecklist } from './SymptomsChecklist';

export interface QuickCheckInProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  /** Called once per answered item (mood, sleep, symptoms). */
  onSave: (o: NewObservation) => Promise<unknown>;
  onExit?: () => void;
  /** Called once after a save attempt with what was saved / not saved (e.g. to show one toast). */
  onSaved?: (outcome: SaveOutcome) => void;
  /** Verdict of a saved item once the domain has evaluated it. */
  verdictFor?: (signalId: SignalId) => Verdict | undefined;
}

export function QuickCheckIn({ crewId, crewName, missionDay, onSave, onExit, verdictFor, onSaved }: QuickCheckInProps) {
  const [mood, setMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState('');
  const [symptoms, setSymptoms] = useState<SymptomId[]>([]);
  const [none, setNone] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [savedObs, setSavedObs] = useState<NewObservation[]>([]);

  const empty = mood === null && sleep.trim() === '' && symptoms.length === 0 && !none;
  const submit = async () => {
    setOutcome(null);
    const r = validateManualDraft({ ...EMPTY_DRAFT, mood, sleepHours: sleep, symptoms, symptomsNone: none }, { crewId, missionDay });
    setErrors(r.errors);
    if (!r.ok) return;
    setSaving(true);
    const res = await saveAll(r.observations, onSave);
    setSaving(false);
    setOutcome(res);
    onSaved?.(res);
    setSavedObs(r.observations.filter((o) => res.saved.includes(o.signalId)));
    if (res.failed.length === 0) {
      setMood(null);
      setSleep('');
      setSymptoms([]);
      setNone(false);
    }
  };
  const described = outcome ? describeOutcome(outcome) : null;

  return (
    <Card title="Quick check-in" actions={<SubjectChip name={crewName} />}>
      <form
        noValidate
        className="mt-3 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <p className="mb-2 text-sm font-medium text-text">Mood</p>
          <MoodScale name={`qc-mood-${crewId}`} value={mood} onChange={setMood} />
        </div>
        <NumberField
          id={`qc-sleep-${crewId}`}
          label="Sleep last night"
          unit="h"
          value={sleep}
          onChange={setSleep}
          step={0.5}
          decimals={1}
          emptyStart={VALID_RANGES.sleepHours.lo}
          hint={<RangeHint lo={VALID_RANGES.sleepHours.lo} hi={VALID_RANGES.sleepHours.hi} unit="h" />}
          error={errors.sleepHours}
        />
        <div>
          <p className="mb-2 text-sm font-medium text-text">Symptoms</p>
          <SymptomsChecklist
            value={symptoms}
            none={none}
            onChange={(v, n) => {
              setSymptoms(v);
              setNone(n);
            }}
          />
        </div>
        {errors.form && <FieldError>{errors.form}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" icon={Save} disabled={saving || empty}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {onExit && (
            <Button variant="ghost" onClick={onExit}>
              Close
            </Button>
          )}
        </div>
        <div aria-live="polite" className="text-sm">
          {described?.savedText && <p className="text-ok-fg">{described.savedText}</p>}
        </div>
      </form>
      {described?.failedText && <ErrorState className="mt-3" title="Not saved" message={described.failedText} />}
      {savedObs.length > 0 && (
        <div className="mt-3">
          <SavedList observations={savedObs} verdictFor={verdictFor} />
        </div>
      )}
    </Card>
  );
}
