// Manual vitals — FR-LAB-1, docs/09_MEASUREMENT_LAB.md §5. One form, large targets, unit toggles, validation per
// doc 06 §3, optional context fields, inline How-to per field. No store or Dexie access: onSave is called once per
// entered signal; the route wrapper (ManualVitalsRoute) wires stores, service and verdicts.
import { Save, User } from 'lucide-react';
import { useRef, useState } from 'react';

import type { NewObservation, SignalId, Verdict } from '../../../domain/types';
import { Button, LinkButton } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { ErrorState } from '../../../ui/States';
import { MoodScale } from '../checkin/MoodScale';
import { SymptomsChecklist } from '../checkin/SymptomsChecklist';
import { SubjectChip } from '../SubjectChip';
import { FieldError, NumberField, RangeHint, ScoreScale, Section, inputCls } from './fields';
import { type SaveOutcome, describeOutcome, saveAll } from './saveAll';
import { SavedList } from './SavedList';
import { CardioSections, TempGlucoseMassSections } from './VitalsSections';
import { EMPTY_DRAFT, type FieldErrors, type GlucoseUnit, type ManualDraft, POSTURES, type Posture, type TempUnit, VALID_RANGES, validateManualDraft } from './validation';

export interface ManualVitalsFormProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  /** Called once per entered signal. */
  onSave: (o: NewObservation) => Promise<unknown>;
  onExit?: () => void;
  /** Initial display units (the user's preference); mass starts in kg. */
  initialUnits?: { temp: TempUnit; glucose: GlucoseUnit };
  /** Called once after a save attempt with what was saved / not saved (e.g. to show one toast). */
  onSaved?: (outcome: SaveOutcome) => void;
  /** Verdict of a saved signal once the domain has evaluated it. */
  verdictFor?: (signalId: SignalId) => Verdict | undefined;
  /** Link to the subject's body view after saving, e.g. /body/c3. */
  bodyLink?: string;
}

const POSTURE_LABEL: Record<Posture, string> = { seated: 'Seated', standing: 'Standing', lying: 'Lying', restrained: 'Restrained (microgravity)' };

export function ManualVitalsForm({ crewId, crewName, missionDay, onSave, onExit, initialUnits, verdictFor, bodyLink, onSaved }: ManualVitalsFormProps) {
  const fresh = (): ManualDraft => ({ ...EMPTY_DRAFT, tempUnit: initialUnits?.temp ?? 'C', glucoseUnit: initialUnits?.glucose ?? 'mg/dL' });
  const [draft, setDraft] = useState<ManualDraft>(fresh);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [savedObs, setSavedObs] = useState<NewObservation[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof ManualDraft>(key: K, value: ManualDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    setOutcome(null);
    const r = validateManualDraft(draft, { crewId, missionDay });
    setErrors(r.errors);
    if (!r.ok) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaving(true);
    const res = await saveAll(r.observations, onSave);
    setSaving(false);
    setOutcome(res);
    onSaved?.(res);
    setSavedObs(r.observations.filter((o) => res.saved.includes(o.signalId)));
    if (res.failed.length === 0) setDraft(fresh());
  };

  const errorList = Object.values(errors);
  const described = outcome ? describeOutcome(outcome) : null;
  return (
    <section aria-labelledby="mv-title" className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="mv-title" className="text-2xl font-semibold">
            Manual vitals
          </h1>
          <SubjectChip name={crewName} />
        </div>
      </header>
      <p className="mb-4 text-sm text-text-2">Fill in only what you measured. Each value is saved as its own entry for mission day {missionDay}.</p>

      <div ref={summaryRef} tabIndex={-1} className="outline-none">
        {errorList.length > 0 && <ErrorState className="mb-4" title="Nothing was saved. Please fix:" message={errorList.join(' ')} />}
      </div>

      <form
        noValidate
        className="grid gap-4 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <CardioSections draft={draft} errors={errors} set={set} />
        <TempGlucoseMassSections draft={draft} errors={errors} set={set} />
        <Section title="Sleep" howTo="sleep">
          <NumberField id="mv-sleep" label="Hours slept" unit="h" value={draft.sleepHours} onChange={(v) => set('sleepHours', v)} step={0.5} decimals={1} emptyStart={VALID_RANGES.sleepHours.lo} hint={<RangeHint lo={VALID_RANGES.sleepHours.lo} hi={VALID_RANGES.sleepHours.hi} unit="h" />} error={errors.sleepHours} />
          <div className="flex basis-full flex-col gap-1">
            <span id="mv-sleep-quality" className="text-sm font-medium text-text">
              Sleep quality (1–5)
            </span>
            <ScoreScale name="mv-sleep-quality" labelledBy="mv-sleep-quality" value={draft.sleepQuality} onChange={(v) => set('sleepQuality', v)} />
            {errors.sleepQuality && <FieldError>{errors.sleepQuality}</FieldError>}
          </div>
        </Section>
        <Section title="Mood" howTo="mood">
          <MoodScale name="mv-mood" value={draft.mood} onChange={(v) => set('mood', v)} />
          {errors.mood && <FieldError>{errors.mood}</FieldError>}
          <div className="flex basis-full flex-col gap-1">
            <label htmlFor="mv-mood-note" className="text-sm font-medium text-text">
              One line about today (optional, shown to the CMO)
            </label>
            <input id="mv-mood-note" type="text" maxLength={200} className={`${inputCls} w-full font-sans text-base`} value={draft.moodNote} onChange={(e) => set('moodNote', e.target.value)} />
            {errors.moodNote && <FieldError>{errors.moodNote}</FieldError>}
          </div>
        </Section>
        <div className="lg:col-span-2">
          <Section title="Symptoms" howTo="symptoms">
            <SymptomsChecklist value={draft.symptoms} none={draft.symptomsNone} onChange={(v, none) => setDraft((d) => ({ ...d, symptoms: v, symptomsNone: none }))} />
          </Section>
        </div>
        <div className="lg:col-span-2">
          <Section title="Context (optional)">
            <div className="flex flex-col gap-1">
              <label htmlFor="mv-posture" className="text-sm font-medium text-text">
                Posture
              </label>
              <select id="mv-posture" className={`${inputCls} w-64 font-sans text-base`} value={draft.posture} onChange={(e) => set('posture', e.target.value as Posture | '')}>
                <option value="">Not stated</option>
                {POSTURES.map((p) => (
                  <option key={p} value={p}>
                    {POSTURE_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <NumberField id="mv-exercise" label="Time since exercise" unit="min" value={draft.minutesSinceExercise} onChange={(v) => set('minutesSinceExercise', v)} step={5} decimals={0} emptyStart={0} error={errors.minutesSinceExercise} />
          </Section>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <Button type="submit" variant="primary" icon={Save} disabled={saving}>
            {saving ? 'Saving…' : 'Save entries'}
          </Button>
          {onExit && <Button onClick={onExit}>Done</Button>}
          <div aria-live="polite" className="text-sm">
            {described?.savedText && <p className="text-ok-fg">{described.savedText}</p>}
          </div>
        </div>
      </form>
      {described?.failedText && <ErrorState className="mt-4" title="Not saved" message={described.failedText} />}
      {savedObs.length > 0 && (
        <Card className="mt-4" title={`Saved for ${crewName}`} actions={bodyLink ? <LinkButton to={bodyLink} icon={User}>{`Open ${crewName}'s body view`}</LinkButton> : undefined}>
          <SavedList observations={savedObs} verdictFor={verdictFor} />
        </Card>
      )}
    </section>
  );
}
