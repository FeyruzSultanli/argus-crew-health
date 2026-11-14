// Protocol runner — keyboard-only start to finish, timer step, trigger evaluation, run record.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mkAssessment } from '../../domain/readiness/fixtures.test-utils';
import type { Assessment } from '../../domain/types';
import { useMissionStore } from '../../state/mission';
import { useSessionStore } from '../../state/session';
import { useUiStore } from '../../state/ui';
import { renderAt } from '../settings/providers.test-utils';
import { getProtocol } from './content';
import { PROTOCOL_RUNS_KEY, loadProtocolRuns } from './protocolRuns';
import { buildTriggerFacts } from './triggerFacts';

const h = vi.hoisted(() => ({ byCrew: {} as Record<string, Assessment[] | undefined> }));
vi.mock('../../services/hooks', () => ({ useAssessments: (id: string) => h.byCrew[id] }));

const { default: HandbookPage } = await import('./HandbookPage');

const infection = getProtocol('suspected-infection');
const press = (key: ' ' | 'Enter') => fireEvent.keyDown(document.activeElement ?? document.body, { key });

beforeEach(() => {
  localStorage.clear();
  useMissionStore.setState({ profileId: 'mars-transit', missionDay: 143, timeCompression: 1 });
  useSessionStore.setState({ role: 'cmo', crewId: 'c4', signedIn: true });
  useUiStore.setState({ selectedCrewId: 'c3' });
  h.byCrew = {
    c3: [
      mkAssessment('c3', 'heart_rate_rest', 'ACT', { P: 'ACT', S: 'NOMINAL', E: 'NOMINAL' }),
      mkAssessment('c3', 'body_temp', 'WATCH'),
    ],
    cabin: [],
  };
});

describe('trigger facts (pure)', () => {
  it('maps combined and layer verdicts, today-only symptoms and the cabin 7-day CO2', () => {
    const symptoms = mkAssessment('c2', 'symptoms', 'NOMINAL');
    symptoms.latest = {
      id: 'x',
      crewId: 'c2',
      signalId: 'symptoms',
      value: 1,
      components: { headache: 1, rash: 0 },
      unit: '1',
      effectiveAt: '2026-11-14T07:00:00Z',
      missionDay: 120,
      source: { kind: 'simulated', label: 'SIMULATED' },
      quality: { score: 1, label: 'good', reasons: [] },
    };
    const co2 = mkAssessment('cabin', 'cabin_co2', 'WATCH', { numbers: { avg7d: 3.9 } });
    const facts = buildTriggerFacts([symptoms], [co2], 120);
    expect(facts.symptoms).toEqual(['headache']);
    expect(facts.cabin).toEqual({ co2Avg7dMmHg: 3.9 });
    expect(facts.spaceWeather).toBeUndefined();
    expect(buildTriggerFacts([symptoms], [co2], 121).symptoms).toEqual([]);
  });
});

describe('protocol runner', () => {
  it('runs suspected-infection start to finish with the keyboard only and stores a run record', () => {
    renderAt(<HandbookPage />, '/handbook/suspected-infection', '/handbook/:entry');
    expect(screen.getByRole('heading', { level: 1, name: 'Suspected infection' })).toBeInTheDocument();
    const n = infection.steps.length;
    infection.steps.forEach((s, i) => {
      const card = screen.getByTestId('protocol-step');
      expect(card).toHaveAttribute('data-step', s.id);
      expect(within(card).getByTestId('step-counter')).toHaveTextContent(`Step ${i + 1} of ${n}`);
      expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(s.text); // verbatim
      expect(within(card).getByRole('heading', { level: 2 })).toHaveFocus();
      expect(within(card).getByTestId('step-tag')).toHaveTextContent('Demo wording');
      if (i === n - 1) {
        expect(within(card).getByRole('link', { name: 'Send report to flight surgeon' })).toHaveAttribute(
          'href',
          '/earth?crew=c3&flags=1',
        );
      }
      press(i % 2 === 0 ? ' ' : 'Enter');
    });
    expect(screen.getByTestId('protocol-complete')).toBeInTheDocument();
    const runs = loadProtocolRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ protocolId: 'suspected-infection', crewId: 'c3', missionDay: 143 });
    expect(runs[0]?.steps.map((s) => s.stepId)).toEqual(infection.steps.map((s) => s.id));
    expect(localStorage.getItem(PROTOCOL_RUNS_KEY)).not.toBeNull();
  });

  it('Back returns to the previous step; Space on a control does not double-advance', () => {
    renderAt(<HandbookPage />, '/handbook/protocol-suspected-infection', '/handbook/:entry');
    press(' ');
    expect(screen.getByTestId('protocol-step')).toHaveAttribute('data-step', 's2');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('protocol-step')).toHaveAttribute('data-step', 's1');
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.keyDown(next, { key: ' ' });
    expect(screen.getByTestId('protocol-step')).toHaveAttribute('data-step', 's1');
  });

  it('timer step shows the real duration, never blocks, and time compression is labelled', () => {
    useMissionStore.setState({ timeCompression: 600 });
    vi.useFakeTimers();
    try {
      renderAt(<HandbookPage />, '/handbook/suspected-infection', '/handbook/:entry');
      press(' ');
      const timer = screen.getByTestId('step-timer');
      expect(timer).toHaveTextContent('Real duration');
      expect(within(timer).getByTestId('timer-compressed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue without waiting' })).toBeEnabled();
      fireEvent.click(within(timer).getByRole('button', { name: 'Start timer' }));
      expect(within(timer).getByRole('timer')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(13_000); // 7200 s / 600 = 12 s
      });
      expect(within(timer).getByRole('timer')).toHaveAccessibleName(/done/);
      press('Enter');
      expect(screen.getByTestId('protocol-step')).toHaveAttribute('data-step', 's3');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the trigger text and whether it is met for the selected crew member', () => {
    renderAt(<HandbookPage />, '/handbook/suspected-infection', '/handbook/:entry');
    const trig = screen.getByTestId('trigger-status');
    expect(trig).toHaveTextContent(infection.triggerPlain);
    expect(within(trig).getByText(/Trigger met now for K. Osei/)).toBeInTheDocument();
  });

  it('trigger not met when the personal layer is nominal; SPE trigger waits for space-weather facts', () => {
    h.byCrew.c3 = [
      mkAssessment('c3', 'heart_rate_rest', 'NOMINAL'),
      mkAssessment('c3', 'body_temp', 'WATCH'),
    ];
    const { unmount } = renderAt(<HandbookPage />, '/handbook/suspected-infection', '/handbook/:entry');
    expect(screen.getByText(/Trigger not met now for K. Osei/)).toBeInTheDocument();
    unmount();
    renderAt(<HandbookPage />, '/handbook/spe-shelter', '/handbook/:entry');
    expect(screen.getByText(/Trigger not met now/)).toBeInTheDocument();
    expect(screen.getByText(/a missing fact never satisfies a condition/)).toBeInTheDocument();
  });
});
