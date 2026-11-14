import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { navItems } from './config/navigation';
import { routes } from './routes';
import { DEMO_PIN, useSessionStore } from './state/session';
import type { Role } from './state/session';
import { useUiStore } from './state/ui';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

function signIn(role: Role, crewId?: string) {
  useSessionStore.getState().signIn({ role, crewId, pin: DEMO_PIN });
}

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().signOut();
});

describe('app shell', () => {
  it('redirects to the role picker when not signed in', async () => {
    const router = renderAt('/environment');
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose who you are' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    // First screen: the three-layer line and the demo sign-in notice.
    expect(
      screen.getByText(
        'Every health reading is judged against your own baseline, space-adapted NASA evidence and Earth reference ranges.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Demo sign-in\. There are no accounts/)).toBeInTheDocument();
  });

  it('mission chip shows a visible "modeled (demo)" for the Mars-transit delay', async () => {
    signIn('cmo');
    renderAt('/');
    const chip = await screen.findByTestId('mission-chip');
    expect(chip).toHaveTextContent('modeled (demo)');
    expect(chip).toHaveAttribute('title', expect.stringContaining('modeled delay (demo)'));
  });

  it('CMO sees every main nav link, the badges and the scrubber on the Bridge', async () => {
    signIn('cmo');
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const item of navItems)
      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', item.to);
    expect(nav).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeInTheDocument();
    expect(screen.getByTestId('simulated-badge')).toHaveTextContent('Simulated data');
    expect(screen.getByTestId('space-weather-badge')).toHaveTextContent('SNAPSHOT');
    expect(screen.getByRole('slider', { name: 'Mission day' })).toBeInTheDocument();
    const chip = screen.getByTestId('mission-chip');
    expect(chip).toHaveTextContent(/Mission profile: Mars transit/);
    expect(chip).toHaveTextContent(/MD 143\/210/);
    expect(chip).toHaveTextContent(/one-way delay\s*11\s*min/);
    expect(chip).toHaveTextContent(/modeled delay \(demo\)/);
  });

  it('Flight surgeon does not see Body or Lab and is blocked from /lab', async () => {
    signIn('surgeon');
    renderAt('/lab');
    expect(await screen.findByText('Not available for this role')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Body' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lab' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Crew' })).toBeInTheDocument();
  });

  it('a crew member is sent to their own body page and cannot open Crew', async () => {
    signIn('crew', 'c3');
    const router = renderAt('/body/c1');
    expect(await screen.findByRole('heading', { level: 1, name: 'K. Osei' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/body/c3');
    expect(screen.queryByRole('link', { name: 'Crew' })).toBeNull();
  });

  it('focused-flow mode collapses the header to a thin bar with Exit and hides the scrubber', async () => {
    signIn('cmo');
    useUiStore.getState().setFocusedFlow({ title: 'Camera pulse', exitTo: '/lab' });
    const router = renderAt('/');
    expect(await screen.findByText('Camera pulse')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Mission day' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/lab'));
    expect(useUiStore.getState().focusedFlow).toBeNull();
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it.each([
    ['/body/c4', 'L. Duarte'],
    ['/trends', 'Trends'],
    ['/lab/vision', 'Vision check'],
    ['/environment', 'Radiation & cabin'],
    ['/crew', 'Crew overview'],
    ['/earth', 'Earth link'],
    ['/handbook/spe-shelter', 'SPE shelter'],
    ['/settings', 'Settings'],
    ['/limits', 'Limits'],
    ['/no-such-page', 'Page not found'],
  ])('renders the page at %s for the CMO', async (path, title) => {
    signIn('cmo');
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });
});
