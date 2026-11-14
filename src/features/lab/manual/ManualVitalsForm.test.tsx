// Manual vitals form: blocks invalid values with a clear message, unit toggles convert, one onSave per signal.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NewObservation } from '../../../domain/types';
import { HOWTO } from './howto';
import { ManualVitalsForm } from './ManualVitalsForm';

function setup(onSave = vi.fn((_o: NewObservation) => Promise.resolve({ id: 'x' }))) {
  render(<ManualVitalsForm crewId="c3" crewName="K. Osei" missionDay={143} onSave={onSave} onExit={() => {}} />);
  return onSave;
}
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ManualVitalsForm', () => {
  it('shows subject chip, every FR-LAB-1 field and the doc 09 §5 how-to texts tagged demo wording', () => {
    setup();
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    for (const l of [/^Systolic/, /^Diastolic/, /^SpO₂/, /^Resting heart rate/, /^Body temperature/, /^Blood glucose/, /^Body mass/, /^Hours slept/, /^Time since exercise/, /^Posture/]) {
      expect(screen.getByLabelText(l)).toBeInTheDocument();
    }
    expect(screen.getByRole('radiogroup', { name: 'Mood today' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /Sleep quality/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Symptoms today' })).toBeInTheDocument();
    const toggles = screen.getAllByRole('button', { name: 'How to measure' });
    expect(toggles).toHaveLength(Object.keys(HOWTO).length);
    toggles.forEach((t) => fireEvent.click(t));
    for (const text of Object.values(HOWTO)) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getAllByText('demo wording')).toHaveLength(Object.keys(HOWTO).length);
    // accepted ranges are shown as demo parameters through <Value>
    expect(screen.getAllByText('Accepted').length).toBeGreaterThanOrEqual(8);
  });

  it('blocks systolic < diastolic with a clear message and saves nothing', async () => {
    const onSave = setup();
    type(/^Systolic/, '70');
    type(/^Diastolic/, '90');
    fireEvent.click(screen.getByRole('button', { name: 'Save entries' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Nothing was saved');
    expect(alert).toHaveTextContent('Systolic (70) must be higher than diastolic (90).');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('blocks out-of-range values in the displayed unit', async () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: '°F' }));
    type(/^Body temperature/, '120');
    fireEvent.click(screen.getByRole('button', { name: 'Save entries' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Temperature must be between 86.0–113.0 °F.');
    expect(screen.getByLabelText(/^Body temperature/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('unit toggles convert the entered value; saves one observation per signal in canonical units', async () => {
    const onSave = setup();
    type(/^Body temperature/, '37');
    fireEvent.click(screen.getByRole('radio', { name: '°F' }));
    expect(screen.getByLabelText(/^Body temperature/)).toHaveValue('98.6');
    type(/^Blood glucose/, '90');
    fireEvent.click(screen.getByRole('radio', { name: 'mmol/L' }));
    expect(screen.getByLabelText(/^Blood glucose/)).toHaveValue('5.0');
    fireEvent.click(screen.getByRole('radio', { name: 'Fasting' }));
    type(/^Systolic/, '118');
    type(/^Diastolic/, '76');
    fireEvent.change(screen.getByLabelText(/^Posture/), { target: { value: 'restrained' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save entries' }));
    expect(await screen.findByText('Saved: blood pressure, temperature, glucose.')).toBeInTheDocument();
    const list = screen.getByTestId('saved-list');
    expect(list).toHaveTextContent('blood pressure');
    expect(list).toHaveTextContent('118/76');
    expect(list).toHaveTextContent('Verdict appears once the reading is evaluated.');
    const saved = onSave.mock.calls.map((c) => c[0]);
    expect(saved).toHaveLength(3);
    expect(saved[0]).toMatchObject({ signalId: 'blood_pressure', value: null, unit: 'mm[Hg]', components: { systolic: 118, diastolic: 76 }, context: { posture: 'restrained' } });
    expect(saved[1]).toMatchObject({ signalId: 'body_temp', unit: 'Cel', value: 37 });
    expect(saved[2]).toMatchObject({ signalId: 'glucose', unit: 'mg/dL', value: 90.1, context: { glucose: 'fasting' } });
    // form resets after a fully successful save
    expect(screen.getByLabelText(/^Systolic/)).toHaveValue('');
  });

  it('steppers: + on an empty field starts at the range low end, − is off when empty', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Decrease Systolic' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Increase Systolic' }));
    expect(screen.getByLabelText(/^Systolic/)).toHaveValue('60');
    fireEvent.click(screen.getByRole('button', { name: 'Increase Systolic' }));
    expect(screen.getByLabelText(/^Systolic/)).toHaveValue('61');
  });

  it('reports a failing service honestly (TEMP placeholder)', async () => {
    setup(vi.fn(() => Promise.reject(new Error('Saved locally is not available yet.'))));
    type(/^Resting heart rate/, '58');
    fireEvent.click(screen.getByRole('button', { name: 'Save entries' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved: heart rate. Saved locally is not available yet.');
    expect(screen.getByLabelText(/^Resting heart rate/)).toHaveValue('58'); // kept for a retry
  });
});

describe('ManualVitalsForm — preferences and verdicts', () => {
  it('starts in the preferred units and shows a verdict pill per saved signal when evaluated', async () => {
    const onSaved = vi.fn();
    render(
      <ManualVitalsForm
        crewId="c3"
        crewName="K. Osei"
        missionDay={143}
        onSave={() => Promise.resolve({})}
        onSaved={onSaved}
        initialUnits={{ temp: 'F', glucose: 'mmol/L' }}
        verdictFor={(id) => (id === 'heart_rate_rest' ? 'WATCH' : undefined)}
      />,
    );
    expect(screen.getByRole('radio', { name: '°F' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'mmol/L' })).toHaveAttribute('aria-checked', 'true');
    type(/^Resting heart rate/, '58');
    fireEvent.click(screen.getByRole('button', { name: 'Save entries' }));
    expect(await screen.findByTestId('saved-list')).toHaveTextContent('Watch');
    expect(screen.queryByText('Verdict appears once the reading is evaluated.')).toBeNull();
    expect(onSaved).toHaveBeenCalledWith({ saved: ['heart_rate_rest'], failed: [] });
  });
});
