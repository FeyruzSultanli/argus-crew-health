// Field sections of the manual vitals form (FR-LAB-1, doc 09 §5). Each section has its inline "How to measure".
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { FieldError, NumberField, RangeHint, Section } from './fields';
import {
  type FieldErrors,
  GLUCOSE_CONTEXTS,
  type GlucoseUnit,
  type ManualDraft,
  type MassUnit,
  type TempUnit,
  VALID_RANGES,
  cToF,
  convertEntry,
  kgToLb,
  mgdlToMmol,
} from './validation';

export interface SectionProps {
  draft: ManualDraft;
  errors: FieldErrors;
  set: <K extends keyof ManualDraft>(key: K, value: ManualDraft[K]) => void;
}

const TEMP_UNITS = [
  { value: 'C', label: '°C' },
  { value: 'F', label: '°F' },
] as const;
const GLUCOSE_UNITS = [
  { value: 'mg/dL', label: 'mg/dL' },
  { value: 'mmol/L', label: 'mmol/L' },
] as const;
const MASS_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const;
const GLUCOSE_CONTEXT_LABEL = { fasting: 'Fasting', random: 'Random', 'post-meal': 'Post-meal' } as const;
const R = VALID_RANGES;

export function CardioSections({ draft, errors, set }: SectionProps) {
  return (
    <>
      <Section title="Blood pressure" howTo="bloodPressure">
        <NumberField id="mv-sys" label="Systolic" unit="mmHg" value={draft.systolic} onChange={(v) => set('systolic', v)} step={1} decimals={0} emptyStart={R.systolic.lo} hint={<RangeHint lo={R.systolic.lo} hi={R.systolic.hi} unit="mm[Hg]" />} error={errors.systolic} />
        <NumberField id="mv-dia" label="Diastolic" unit="mmHg" value={draft.diastolic} onChange={(v) => set('diastolic', v)} step={1} decimals={0} emptyStart={R.diastolic.lo} hint={<RangeHint lo={R.diastolic.lo} hi={R.diastolic.hi} unit="mm[Hg]" />} error={errors.diastolic} />
        {errors.bloodPressure && (
          <div className="basis-full">
            <FieldError id="mv-bp-err">{errors.bloodPressure}</FieldError>
          </div>
        )}
      </Section>
      <Section title="Pulse oximeter" howTo="pulseOximetry">
        <NumberField id="mv-spo2" label="SpO₂" unit="%" value={draft.spo2} onChange={(v) => set('spo2', v)} step={1} decimals={0} emptyStart={R.spo2.lo} hint={<RangeHint lo={R.spo2.lo} hi={R.spo2.hi} unit="%" />} error={errors.spo2} />
        <NumberField id="mv-hr" label="Resting heart rate" unit="bpm" value={draft.heartRate} onChange={(v) => set('heartRate', v)} step={1} decimals={0} emptyStart={R.heartRate.lo} hint={<RangeHint lo={R.heartRate.lo} hi={R.heartRate.hi} unit="/min" />} error={errors.heartRate} />
      </Section>
    </>
  );
}

function UnitToggle<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="self-center">
      <SegmentedControl<T> label={label} options={options} value={value} onChange={onChange} />
    </div>
  );
}

export function TempGlucoseMassSections({ draft, errors, set }: SectionProps) {
  const f = draft.tempUnit === 'F';
  const mmol = draft.glucoseUnit === 'mmol/L';
  const lb = draft.massUnit === 'lb';
  // Stepper start on an empty field = low end of the valid range, in the unit shown (rounded up into the range).
  const tempLo = f ? Math.ceil(cToF(R.bodyTemp.lo)) : R.bodyTemp.lo;
  const gluLo = mmol ? Math.ceil(mgdlToMmol(R.glucose.lo) * 10) / 10 : R.glucose.lo;
  const massLo = lb ? Math.ceil(kgToLb(R.bodyMass.lo)) : R.bodyMass.lo;
  const tempHint = f ? <RangeHint lo={cToF(R.bodyTemp.lo)} hi={cToF(R.bodyTemp.hi)} decimals={1} unit="°F" /> : <RangeHint lo={R.bodyTemp.lo} hi={R.bodyTemp.hi} unit="°C" />;
  const gluHint = mmol ? <RangeHint lo={mgdlToMmol(R.glucose.lo)} hi={mgdlToMmol(R.glucose.hi)} decimals={1} unit="mmol/L" /> : <RangeHint lo={R.glucose.lo} hi={R.glucose.hi} unit="mg/dL" />;
  const massHint = lb ? <RangeHint lo={kgToLb(R.bodyMass.lo)} hi={kgToLb(R.bodyMass.hi)} decimals={1} unit="lb" /> : <RangeHint lo={R.bodyMass.lo} hi={R.bodyMass.hi} unit="kg" />;
  return (
    <>
      <Section title="Temperature" howTo="temperature">
        <NumberField id="mv-temp" label="Body temperature" unit={f ? '°F' : '°C'} value={draft.bodyTemp} onChange={(v) => set('bodyTemp', v)} step={0.1} decimals={1} emptyStart={tempLo} hint={tempHint} error={errors.bodyTemp} />
        <UnitToggle<TempUnit>
          label="Temperature unit"
          options={TEMP_UNITS}
          value={draft.tempUnit}
          onChange={(u) => {
            set('bodyTemp', convertEntry(draft.bodyTemp, 'bodyTemp', draft.tempUnit, u));
            set('tempUnit', u);
          }}
        />
      </Section>
      <Section title="Glucose" howTo="glucose">
        <NumberField id="mv-glu" label="Blood glucose" unit={draft.glucoseUnit} value={draft.glucose} onChange={(v) => set('glucose', v)} step={mmol ? 0.1 : 1} decimals={mmol ? 1 : 0} emptyStart={gluLo} hint={gluHint} error={errors.glucose} />
        <UnitToggle<GlucoseUnit>
          label="Glucose unit"
          options={GLUCOSE_UNITS}
          value={draft.glucoseUnit}
          onChange={(u) => {
            set('glucose', convertEntry(draft.glucose, 'glucose', draft.glucoseUnit, u));
            set('glucoseUnit', u);
          }}
        />
        <div className="flex basis-full flex-col gap-1">
          <span id="mv-glu-ctx" className="text-sm font-medium text-text">
            When was it taken?
          </span>
          <div role="radiogroup" aria-labelledby="mv-glu-ctx" className="flex flex-wrap gap-2">
            {GLUCOSE_CONTEXTS.map((c) => (
              <label key={c} className="relative cursor-pointer">
                <input type="radio" name="mv-glucose-context" value={c} checked={draft.glucoseContext === c} onChange={() => set('glucoseContext', c)} className="peer absolute inset-0 m-0 opacity-0" />
                <span className="flex min-h-target items-center rounded-pill border border-border-strong bg-surface-2 px-4 text-sm text-text-2 peer-checked:border-brand peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                  {GLUCOSE_CONTEXT_LABEL[c]}
                </span>
              </label>
            ))}
          </div>
          {errors.glucoseContext && <FieldError>{errors.glucoseContext}</FieldError>}
        </div>
      </Section>
      <Section title="Body mass" howTo="bodyMass">
        <NumberField id="mv-mass" label="Body mass" unit={draft.massUnit} value={draft.bodyMass} onChange={(v) => set('bodyMass', v)} step={0.1} decimals={1} emptyStart={massLo} hint={massHint} error={errors.bodyMass} />
        <UnitToggle<MassUnit>
          label="Mass unit"
          options={MASS_UNITS}
          value={draft.massUnit}
          onChange={(u) => {
            set('bodyMass', convertEntry(draft.bodyMass, 'bodyMass', draft.massUnit, u));
            set('massUnit', u);
          }}
        />
      </Section>
    </>
  );
}
