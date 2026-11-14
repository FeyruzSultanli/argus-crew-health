import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../routes';
import { useMissionStore } from '../../state/mission';
import { DEMO_PIN, useSessionStore } from '../../state/session';
import { useUiStore } from '../../state/ui';

// jsdom has no WebGL: the page must take the 2D fallback (FR-BODY-6).
vi.mock('./webgl', () => ({ webglAvailable: () => false, resetWebglProbe: () => undefined }));
// Fixture data, independent of the adapter (so these tests survive the swap to the real service hooks).
vi.mock('./bodyData', async () => {
  const f = await import('./bodyFixtures');
  const { useMemo } = await import('react');
  return {
    useAssessments: (c: string, d: number) => useMemo(() => f.buildAssessments(c, d), [c, d]),
    useAllAssessments: (d: number) => useMemo(() => f.buildAllAssessments(d), [d]),
    usePersonalSeries: (c: string, s: Parameters<typeof f.buildSeries>[1], d: number) =>
      useMemo(() => f.buildSeries(c, s, d), [c, s, d]),
  };
});

beforeAll(() => {
  // Recharts' responsive container needs ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().signIn({ role: 'cmo', pin: DEMO_PIN });
  useMissionStore.getState().resetToToday();
  useUiStore.setState({ layerLens: 'combined', bodySystemFilter: 'all', selectedSignalId: null });
});

async function renderBody(path = '/body/c3') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'K. Osei' }, { timeout: 5000 });
  return router;
}

const heart = () => document.querySelector<HTMLButtonElement>('[data-region="heart"]');

describe('Body page (2D fallback)', () => {
  it('renders the SVG body, credit caption, counters and the attention list', async () => {
    await renderBody();
    expect(screen.getByTestId('body-svg')).toBeInTheDocument();
    expect(screen.getByTestId('credit-caption')).toHaveTextContent(
      'Reference body, not a scan of this person: HRA 3D Reference Organs (Visible Human), HuBMAP, CC BY 4.0.',
    );
    const counters = screen.getByTestId('layer-counters');
    expect(within(counters).getByText('Caught only by personal').nextElementSibling).toHaveTextContent('1');
    expect(within(counters).getByText('Earth false alarms').nextElementSibling).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: '1 needs attention' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Heart\s*Act$/ })).toHaveLength(1);
  });

  it('lens: heart is ACT under Combined/Personal and neutral under Earth/Space (doc 14 §3.4)', async () => {
    await renderBody();
    const lens = screen.getByRole('radiogroup', { name: 'Layer lens' });
    expect(heart()).toHaveAttribute('data-verdict', 'ACT');
    for (const [name, verdict] of [
      ['Earth', 'NOMINAL'],
      ['Space', 'NOMINAL'],
      ['Personal', 'ACT'],
      ['Combined', 'ACT'],
    ] as const) {
      fireEvent.click(within(lens).getByRole('radio', { name }));
      expect(heart()).toHaveAttribute('data-verdict', verdict);
    }
  });

  it('clicking the heart hotspot opens the heart-rate card with the FR-SIG-4 order', async () => {
    await renderBody();
    const h = heart();
    expect(h?.tagName).toBe('BUTTON'); // native button → Enter/Space work from the keyboard
    act(() => h?.click());
    expect(useUiStore.getState().selectedSignalId).toBe('heart_rate_rest');
    const card = document.querySelector('[data-signal="heart_rate_rest"]');
    expect(card).not.toBeNull();
    const toggle = within(card as HTMLElement).getByRole('button', { expanded: true });
    const detail = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(detail).not.toBeNull();
    const d = within(detail as HTMLElement);
    const steps = [
      d.getByRole('group', { name: 'Do this next' }),
      d.getByRole('heading', { name: 'Why' }),
      d.getByRole('heading', { name: 'Layers' }),
      d.getByRole('heading', { name: 'Trend vs your band' }),
      d.getByRole('heading', { name: 'About this measurement' }),
      d.getByRole('heading', { name: 'Provenance' }),
    ];
    for (let i = 1; i < steps.length; i += 1) {
      const prev = steps[i - 1] as HTMLElement;
      expect(
        prev.compareDocumentPosition(steps[i] as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    // Action text verbatim from the assessment, with the protocol button.
    const action = d.getByRole('group', { name: 'Do this next' });
    expect(action).toHaveTextContent(
      'Tell the CMO. Check temperature and symptoms. Open protocol: Suspected infection / overreaching.',
    );
    expect(within(action).getByRole('link', { name: 'Open protocol' })).toHaveAttribute(
      'href',
      '/handbook/suspected-infection',
    );
    expect(d.getByRole('button', { name: 'Sources for this card' })).toBeInTheDocument();
  });

  it('organ card: function (demo wording), sourced space facts, linked signals', async () => {
    await renderBody();
    act(() => heart()?.click());
    const card = screen.getByTestId('organ-card');
    const c = within(card);
    expect(c.getByRole('heading', { name: 'Heart' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Pumps blood around the body.');
    expect(card).toHaveTextContent('demo wording');
    expect(card).toHaveTextContent('Weightlessness alters circulation');
    expect(c.getByRole('button', { name: /Resting heart rate/ })).toBeInTheDocument();
    expect(c.getByRole('button', { name: /Blood pressure/ })).toBeInTheDocument();
    fireEvent.click(c.getByRole('button', { name: /Blood pressure/ }));
    expect(useUiStore.getState().selectedSignalId).toBe('blood_pressure');
    fireEvent.click(c.getByRole('button', { name: 'Close organ card' }));
    expect(screen.queryByTestId('organ-card')).toBeNull();
  });

  it('system filter hides regions outside the system', async () => {
    await renderBody();
    fireEvent.click(screen.getByRole('button', { name: 'Brain, eyes & nerves' }));
    expect(heart()).toBeNull();
    expect(document.querySelector('[data-region="brain"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(heart()).not.toBeNull();
  });

  it('mission day changes recolour the body (scrubber)', async () => {
    await renderBody();
    act(() => useMissionStore.getState().setMissionDay(141));
    expect(heart()).toHaveAttribute('data-verdict', 'WATCH');
    act(() => useMissionStore.getState().setMissionDay(120));
    expect(heart()).toHaveAttribute('data-verdict', 'NO_DATA');
  });
});
