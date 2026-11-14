// Quick check-in: mood + sleep + symptoms → one onSave per answered item, honest save outcome.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NewObservation } from '../../../domain/types';
import { QuickCheckIn } from './QuickCheckIn';

function setup(onSave = vi.fn((_o: NewObservation) => Promise.resolve({ id: 'x' }))) {
  render(<QuickCheckIn crewId="c3" crewName="K. Osei" missionDay={143} onSave={onSave} />);
  return onSave;
}

describe('QuickCheckIn', () => {
  it('shows the subject chip; Save is off until something is answered', () => {
    setup();
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('two taps: a mood face + Save saves one mood observation', async () => {
    const onSave = setup();
    fireEvent.click(screen.getByRole('radio', { name: '4 – Good' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved: mood.')).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ crewId: 'c3', missionDay: 143, signalId: 'mood', value: 4, unit: '{score}', source: { kind: 'manual', label: 'MEASURED' }, quality: { score: 1, label: 'good', reasons: [] } });
  });

  it('mood + sleep + symptom chips → three observations', async () => {
    const onSave = setup();
    fireEvent.click(screen.getByRole('radio', { name: '2 – Low' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Sleep last night/ }), { target: { value: '5.5' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Headache' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fatigue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved: sleep, mood, symptoms.')).toBeInTheDocument();
    const saved = onSave.mock.calls.map((c) => c[0]);
    expect(saved.map((o) => o.signalId)).toEqual(['sleep_duration', 'mood', 'symptoms']);
    expect(saved[0]).toMatchObject({ value: 5.5, unit: 'h' });
    expect(saved[2]?.components).toMatchObject({ headache: 1, fatigue: 1, nausea: 0 });
  });

  it('"No symptoms" clears ticked chips; sleep stepper; out-of-range sleep is blocked', async () => {
    const onSave = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rash' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'No symptoms' }));
    expect(screen.getByRole('checkbox', { name: 'Rash' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Increase Sleep last night' }));
    expect(screen.getByRole('textbox', { name: /Sleep last night/ })).toHaveValue('0.0');
    fireEvent.change(screen.getByRole('textbox', { name: /Sleep last night/ }), { target: { value: '17' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Sleep must be between 0–16 h.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reports failed saves honestly', async () => {
    setup(vi.fn(() => Promise.reject(new Error('Saved locally is not available yet.'))));
    fireEvent.click(screen.getByRole('radio', { name: '3 – Okay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved: mood. Saved locally is not available yet.');
  });
});
