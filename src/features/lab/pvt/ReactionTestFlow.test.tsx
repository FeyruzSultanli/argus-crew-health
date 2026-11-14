// Reaction Self-Test flow: scripted test mode end to end (saved observation shape), real-mode keyboard input,
// tab-hidden pause, Esc stop, and the observation builder's range guard.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NewObservation } from '../../../domain/types';
import type { PvtScore } from '../../../measurement/pvt';
import { buildReactionObservation } from './observation';
import { ReactionTestFlow } from './ReactionTestFlow';
import { testModeFromSearch } from './testMode';

const RESULT = { timeout: 5000 };

function renderFlow(extra: Partial<Parameters<typeof ReactionTestFlow>[0]> = {}) {
  const onSave = vi.fn((_o: NewObservation) => Promise.resolve({ id: 'x' }));
  const onExit = vi.fn();
  render(<ReactionTestFlow crewId="c3" crewName="K. Osei" missionDay={143} onSave={onSave} onExit={onExit} {...extra} />);
  return { onSave, onExit };
}

describe('ReactionTestFlow — scripted test mode', () => {
  it('slow profile reaches a result with many lapses and saves the reaction_test shape labeled SIMULATED', async () => {
    const { onSave } = renderFlow({ testMode: { profile: 'slow', seed: 2026 } });
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    expect(screen.getAllByTestId('pvt-test-mode')[0]).toHaveTextContent('TEST MODE — scripted responses');
    expect(screen.getByText(/Use the same device for comparable results/)).toBeInTheDocument();
    expect(screen.getByTestId('pvt-practice-notice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start 3-minute test' }));
    expect(screen.getByRole('dialog', { name: 'Reaction Self-Test' })).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Result' }, RESULT);
    expect(screen.queryByRole('dialog')).toBeNull();
    const lapses = Number(screen.getByTestId('pvt-lapses').dataset.raw);
    const stimuli = Number(screen.getByTestId('pvt-stimuli').dataset.raw);
    expect(stimuli).toBeGreaterThan(30);
    expect(lapses / stimuli).toBeGreaterThan(0.6);
    expect(screen.getAllByTestId('pvt-test-mode').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Saved for K. Osei, mission day 143/);
    expect(onSave).toHaveBeenCalledTimes(1);
    const o = onSave.mock.calls[0]?.[0] as NewObservation;
    expect(o).toMatchObject({
      crewId: 'c3',
      signalId: 'reaction_test',
      unit: '/s',
      missionDay: 143,
      source: { kind: 'simulated', label: 'SIMULATED' },
      quality: { score: 1, label: 'good', reasons: [] },
    });
    expect(o.source.method).toBe('PVT-B style; scripted test mode (slow); ISI seed 2026');
    expect(Object.keys(o.components ?? {}).sort()).toEqual(['falseStarts', 'lapses', 'medianRtMs', 'nStimuli']);
    expect(o.components?.lapses).toBe(lapses);
    expect(o.components?.nStimuli).toBe(stimuli);
    expect(o.value).toBeGreaterThanOrEqual(1);
    expect(o.value).toBeLessThanOrEqual(10);
    expect(o.value).toBeCloseTo(Number(screen.getByTestId('pvt-speed').dataset.raw), 3);
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
  });

  it('normal profile has few lapses; the same seed gives the same result', async () => {
    renderFlow({ testMode: { profile: 'normal', seed: 7 } });
    fireEvent.click(screen.getByRole('button', { name: 'Start 3-minute test' }));
    await screen.findByRole('heading', { name: 'Result' }, RESULT);
    const first = ['pvt-lapses', 'pvt-stimuli', 'pvt-median', 'pvt-speed'].map((id) => screen.getByTestId(id).dataset.raw);
    expect(Number(first[0]) / Number(first[1])).toBeLessThan(0.2);
    fireEvent.click(screen.getByRole('button', { name: /Retake/ }));
    await screen.findByRole('heading', { name: 'Result' }, RESULT);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const second = ['pvt-lapses', 'pvt-stimuli', 'pvt-median', 'pvt-speed'].map((id) => screen.getByTestId(id).dataset.raw);
    expect(second).toEqual(first);
  });

  it('shows an honest message when saving fails', async () => {
    renderFlow({
      testMode: { profile: 'normal', seed: 3 },
      onSave: () => Promise.reject(new Error('Saved locally is not available yet.')),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start 3-minute test' }));
    await screen.findByRole('heading', { name: 'Result' }, RESULT);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Saved locally is not available yet.');
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved');
  });

  it('labels the first-ever run "practice"', async () => {
    renderFlow({ testMode: { profile: 'normal', seed: 3 }, isPractice: true });
    expect(screen.getByTestId('pvt-practice-notice')).toHaveTextContent(/first Reaction Self-Test/);
    fireEvent.click(screen.getByRole('button', { name: 'Start 3-minute test' }));
    await screen.findByRole('heading', { name: 'Result' }, RESULT);
    expect(screen.getByText('Practice run')).toBeInTheDocument();
  });
});

describe('ReactionTestFlow — real mode', () => {
  it('Space before the stimulus is a false start; tab hidden pauses; Esc stops without saving', async () => {
    const { onSave } = renderFlow({ testMode: null });
    expect(screen.queryByTestId('pvt-test-mode')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start 3-minute test' }));
    const target = screen.getByTestId('pvt-target');
    expect(target).toHaveFocus();
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(await screen.findByText(/False start/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Tab' }); // ignored, not a response
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(await screen.findByText(/Paused/)).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(screen.queryByText(/Paused/)).toBeNull());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByRole('heading', { name: 'Test stopped' })).toBeInTheDocument();
    expect(screen.getByText(/You stopped the test. Nothing was saved./)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('a pointer press on the tap target counts; the follow-up mouse click does not count twice', async () => {
    renderFlow({ testMode: null });
    fireEvent.click(screen.getByRole('button', { name: 'Start 3-minute test' }));
    const target = screen.getByTestId('pvt-target');
    fireEvent.pointerDown(target);
    fireEvent.click(target, { detail: 1 });
    expect(await screen.findByText(/False start/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop (Esc)' }));
    expect(await screen.findByRole('heading', { name: 'Test stopped' })).toBeInTheDocument();
  });
});

describe('testModeFromSearch', () => {
  it('parses ?pvtTest=1&pvtProfile=slow and defaults', () => {
    expect(testModeFromSearch('')).toBeNull();
    expect(testModeFromSearch('?pvtTest=1')).toEqual({ profile: 'normal', seed: 2026 });
    expect(testModeFromSearch('?pvtTest=1&pvtProfile=slow&pvtSeed=99')).toEqual({ profile: 'slow', seed: 99 });
  });
});

describe('buildReactionObservation', () => {
  const base: PvtScore = { nStimuli: 60, nRtResponses: 58, medianRtMs: 281.4, meanSpeed: 3.51234, lapses: 2, falseStarts: 2, timeouts: 0, performanceScore: 0.93 };
  it('real run → MEASURED, kind manual, rounded value and median, seed in the method', () => {
    const r = buildReactionObservation(base, { crewId: 'c1', missionDay: 10, seed: 42, testMode: null });
    expect(r).toEqual({
      ok: true,
      observation: {
        crewId: 'c1',
        signalId: 'reaction_test',
        value: 3.512,
        unit: '/s',
        components: { medianRtMs: 281, lapses: 2, falseStarts: 2, nStimuli: 60 },
        missionDay: 10,
        source: { kind: 'manual', method: 'PVT-B style; ISI seed 42', label: 'MEASURED' },
        quality: { score: 1, label: 'good', reasons: [] },
      },
    });
  });
  it('blocks results outside the doc 06 §3 range 1.0–10.0 /s and runs with no valid response', () => {
    expect(buildReactionObservation({ ...base, meanSpeed: 0.9 }, { crewId: 'c1', missionDay: 1, seed: 1, testMode: null })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('outside the accepted range 1.0–10.0 /s'),
    });
    expect(buildReactionObservation({ ...base, meanSpeed: 10 }, { crewId: 'c1', missionDay: 1, seed: 1, testMode: null }).ok).toBe(true);
    expect(buildReactionObservation({ ...base, meanSpeed: null, medianRtMs: null }, { crewId: 'c1', missionDay: 1, seed: 1, testMode: null }).ok).toBe(false);
  });
});
