// /lab hub, /lab/camera and /lab/:flow switch, against the real stores and a fake IndexedDB (no demo seed: the roster falls
// back to seed/crew.json, "last measured" comes from observations added in the test).
import 'fake-indexeddb/auto';

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '../../services/db';
import { healthService } from '../../services/healthService';
import { useMissionStore } from '../../state/mission';
import { DEMO_PIN, useSessionStore } from '../../state/session';
import type { Role } from '../../state/session';
import { useUiStore } from '../../state/ui';
import LabPage from './LabPage';
import { labSubjectId } from './subject';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/lab', Component: LabPage },
      { path: '/lab/:flow', Component: LabPage },
      { path: '/body/:crewId', element: <p>body</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function signIn(role: Role, crewId?: string) {
  act(() => {
    useSessionStore.getState().signIn({ role, crewId, pin: DEMO_PIN });
  });
}

beforeEach(async () => {
  localStorage.clear();
  useMissionStore.setState({ missionDay: 143 });
  useUiStore.getState().setSelectedCrew(null);
  useUiStore.getState().setFocusedFlow(null);
  useSessionStore.getState().signOut();
  await db.observations.clear();
});
afterAll(async () => {
  db.close();
  await db.delete();
});

describe('Lab hub', () => {
  it('CMO: six tiles, subject picker over the four crew, picking changes the subject', async () => {
    signIn('cmo');
    renderAt('/lab');
    expect(screen.getByRole('heading', { level: 1, name: 'Measurement Lab' })).toBeInTheDocument();
    for (const t of ['Camera pulse', 'Reaction Self-Test', 'Manual vitals', 'Vision check', 'Device import', 'Face fluid-shift scan']) {
      expect(screen.getByRole('heading', { level: 2, name: t })).toBeInTheDocument();
    }
    const picker = await screen.findByRole('radiogroup', { name: 'Measurement subject' });
    expect(within(picker).getAllByRole('radio')).toHaveLength(4);
    // The CMO picks first (doc 09 intro) — no default to the CMO's own record.
    expect(screen.queryByText(/Measuring:/)).toBeNull();
    expect(screen.getByTestId('lab-subject-pick')).toHaveTextContent('Pick the crew member first.');
    expect(screen.getByTestId('lab-tile-pvt-last')).toHaveTextContent('Choose who is being measured first');
    fireEvent.click(within(picker).getByRole('radio', { name: 'M. Ito' }));
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: M. Ito');
    expect(useUiStore.getState().selectedCrewId).toBe('c2');
    expect(screen.getByText('Experimental — not validated')).toBeInTheDocument();
    expect(screen.getAllByText('Coming next')).toHaveLength(1); // vision and the face scan are live; device import is not
  });

  it('crew member measures themself (no picker); last measured shows the newest reading', async () => {
    signIn('crew', 'c3');
    await healthService.addObservation({
      crewId: 'c3',
      signalId: 'reaction_test',
      value: 3.456,
      unit: '/s',
      components: { medianRtMs: 280, lapses: 2, falseStarts: 0, nStimuli: 60 },
      missionDay: 143,
      source: { kind: 'manual', method: 'PVT-B style; ISI seed 1', label: 'MEASURED' },
      quality: { score: 1, label: 'good', reasons: [] },
    });
    renderAt('/lab');
    expect(screen.queryByRole('radiogroup', { name: 'Measurement subject' })).toBeNull();
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    const last = await screen.findByTestId('lab-tile-pvt-last');
    await within(last).findByText('3.46');
    expect(last).toHaveTextContent('MEASURED');
    expect(screen.getByTestId('lab-tile-camera-last')).toHaveTextContent('Not measured yet');
  });

  it('flight surgeon gets a read-only explanation', () => {
    signIn('surgeon');
    renderAt('/lab');
    expect(screen.getByText('The Measurement Lab is used on board')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Start/ })).toBeNull();
  });
});

describe('LabPage flows', () => {
  it('/lab/pvt and /lab/manual render the flows for the subject in focused-flow mode', () => {
    signIn('crew', 'c3');
    renderAt('/lab/pvt');
    expect(screen.getByRole('heading', { level: 1, name: 'Reaction Self-Test' })).toBeInTheDocument();
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    expect(useUiStore.getState().focusedFlow).toEqual({ title: 'Reaction Self-Test', exitTo: '/lab' });
  });

  it('/lab/manual', () => {
    signIn('cmo');
    act(() => useUiStore.getState().setSelectedCrew('c1'));
    renderAt('/lab/manual');
    expect(screen.getByRole('heading', { level: 1, name: 'Manual vitals' })).toBeInTheDocument();
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: R. Vance');
    expect(useUiStore.getState().focusedFlow).toEqual({ title: 'Manual vitals', exitTo: '/lab' });
  });

  it('/lab/import, /lab/face show "coming next" cards with sources; /lab/vision is live', async () => {
    signIn('cmo');
    renderAt('/lab/import');
    expect(screen.getByRole('heading', { level: 1, name: 'Measurement Lab' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Device import — coming next' })).toBeInTheDocument();
    expect(screen.getByText(/Formats like CSA/)).toBeInTheDocument();
    renderAt('/lab/vision');
    expect(await screen.findByRole('heading', { level: 1, name: 'Vision check' })).toBeInTheDocument();
  });

  it('/lab/face carries the experimental badge', async () => {
    signIn('crew', 'c3');
    renderAt('/lab/face'); // the live, lazy-loaded scan (flag-off "coming next" is tested in face/featureFlag.test.tsx)
    expect(await screen.findByRole('heading', { level: 1, name: 'Face fluid-shift scan' })).toBeInTheDocument();
    expect(screen.getAllByText('Experimental — not validated').length).toBeGreaterThan(0);
  });
});

describe('LabPage → CameraPulseRoute', () => {
  it('a crew member measures themself; the header collapses to the focused-flow bar', () => {
    act(() => useSessionStore.setState({ role: 'crew', crewId: 'c3', signedIn: true }));
    renderAt('/lab/camera');
    expect(screen.getByRole('heading', { level: 1, name: 'Camera pulse' })).toBeInTheDocument();
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    expect(useUiStore.getState().focusedFlow).toEqual({ title: 'Camera pulse', exitTo: '/lab' });
  });

  it('a crew member always measures themself, even with a selection left from another role (FR-CREW-2)', () => {
    act(() => useSessionStore.setState({ role: 'crew', crewId: 'c3', signedIn: true }));
    act(() => useUiStore.setState({ selectedCrewId: 'c1' }));
    renderAt('/lab/camera');
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
  });

  it('a CMO with no selection picks the crew member first, and can change it', () => {
    act(() => useSessionStore.setState({ role: 'cmo', crewId: 'c4', signedIn: true }));
    renderAt('/lab/camera');
    expect(screen.getByRole('heading', { name: 'Who is being measured?' })).toBeInTheDocument();
    expect(screen.queryByText(/Measuring:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /M\. Ito/ }));
    expect(useUiStore.getState().selectedCrewId).toBe('c2');
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: M. Ito');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    });
    expect(screen.getByRole('heading', { name: 'Who is being measured?' })).toBeInTheDocument();
  });

  it('the CMO with a selection measures that crew member and can change it', () => {
    act(() => useSessionStore.setState({ role: 'cmo', crewId: 'c4', signedIn: true }));
    act(() => useUiStore.setState({ selectedCrewId: 'c3' }));
    renderAt('/lab/camera');
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });
});

describe('one subject rule for every Lab route', () => {
  it('labSubjectId: crew → self, CMO → selection or null, surgeon / signed out → null', () => {
    expect(labSubjectId('crew', 'c3', 'c1')).toBe('c3');
    expect(labSubjectId('crew', 'c3', null)).toBe('c3');
    expect(labSubjectId('cmo', 'c4', 'c2')).toBe('c2');
    expect(labSubjectId('cmo', 'c4', null)).toBeNull();
    expect(labSubjectId('surgeon', null, 'c2')).toBeNull();
    expect(labSubjectId(null, null, 'c2')).toBeNull();
  });

  for (const [path, h1] of [
    ['/lab/pvt', 'Reaction Self-Test'],
    ['/lab/manual', 'Manual vitals'],
    ['/lab/camera', 'Camera pulse'],
  ] as const) {
    it(`${path}: a CMO with no selection picks first, then measures the picked crew member`, () => {
      signIn('cmo');
      renderAt(path);
      expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Who is being measured?' })).toBeInTheDocument();
      expect(screen.queryByText(/Measuring:/)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /K\. Osei/ }));
      expect(useUiStore.getState().selectedCrewId).toBe('c3');
      expect(screen.getAllByText(/Measuring:/)[0]).toHaveTextContent('Measuring: K. Osei');
    });
  }

  it('the flight surgeon gets the read-only notice on a flow route too', () => {
    signIn('surgeon');
    renderAt('/lab/pvt');
    expect(screen.getByText('The Measurement Lab is used on board')).toBeInTheDocument();
  });
});
