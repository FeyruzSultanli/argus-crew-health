// Bridge drop-in: subject and day from the stores, saved through the real (fake-IndexedDB) health service.
import 'fake-indexeddb/auto';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '../../../services/db';
import { healthService } from '../../../services/healthService';
import { DEMO_PIN, useSessionStore } from '../../../state/session';
import { useUiStore } from '../../../state/ui';
import { QuickCheckInConnected } from './QuickCheckInConnected';

afterAll(async () => {
  db.close();
  await db.delete();
});

describe('QuickCheckInConnected', () => {
  it('saves the signed-in crew member’s mood and symptoms for the current mission day', async () => {
    act(() => {
      useSessionStore.getState().signIn({ role: 'crew', crewId: 'c3', pin: DEMO_PIN });
    });
    render(<QuickCheckInConnected />);
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    fireEvent.click(screen.getByRole('radio', { name: '4 – Good' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'No symptoms' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved: mood, symptoms.')).toBeInTheDocument();
    await waitFor(async () => {
      const saved = await healthService.observations({ crewId: 'c3' });
      expect(saved.map((o) => o.signalId).sort()).toEqual(['mood', 'symptoms']);
      expect(saved.every((o) => o.missionDay === 143)).toBe(true);
    });
    expect(screen.getByTestId('saved-list')).toHaveTextContent('No symptoms');
  });

  it('the CMO checks in for their own record, not the crew member selected elsewhere (self-report)', () => {
    act(() => {
      useSessionStore.getState().signIn({ role: 'cmo', pin: DEMO_PIN });
      useUiStore.getState().setSelectedCrew('c3');
    });
    render(<QuickCheckInConnected />);
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: L. Duarte');
    act(() => useUiStore.getState().setSelectedCrew(null));
  });

  it('renders nothing for the flight surgeon', () => {
    act(() => {
      useSessionStore.getState().signIn({ role: 'surgeon', pin: DEMO_PIN });
    });
    const { container } = render(<QuickCheckInConnected />);
    expect(container).toBeEmptyDOMElement();
  });
});
