// Face-scan flow test against the real stores, the real health service (fake IndexedDB) and the real domain rule, with
// a fake camera and a mocked landmarker that feeds synthetic landmarks / blendshapes / transformation matrices:
// first scan → reference (index 1.00) → second scan 3 % wider → 1.03 "+3 %", verdicts as the domain returns them.
import 'fake-indexeddb/auto';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../../../services/db';
import { useMissionStore } from '../../../state/mission';
import { DEMO_PIN, useSessionStore } from '../../../state/session';
import { useUiStore } from '../../../state/ui';
import { EXPERIMENTAL, NO_IMAGE_LINE, PRIVACY_LINE, REFERENCE_EXPLAINER, REFERENCE_NAME, TREND_ONLY } from './copy';
import { FaceScanRoute } from './FaceScanRoute';
import { REFERENCE_KEY, loadReference } from './referenceStore';
import { fakeFaceDeps } from './testDeps';

const SLOW = { timeout: 10_000 };
let spies: Array<ReturnType<typeof vi.spyOn>> = [];
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  useMissionStore.setState({ missionDay: 143 });
  useUiStore.getState().setSelectedCrew(null);
  act(() => useSessionStore.getState().signIn({ role: 'crew', crewId: 'c3', pin: DEMO_PIN }));
  await db.observations.clear();
  spies = [
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined),
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null),
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL'),
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob'),
  ];
  fetchSpy = vi.fn(() => Promise.reject(new Error('network not allowed in this test')));
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  spies.forEach((s) => s.mockRestore());
  vi.unstubAllGlobals();
});
afterAll(async () => {
  db.close();
  await db.delete();
});

function renderRoute(deps: ReturnType<typeof fakeFaceDeps>['deps']) {
  return render(
    <MemoryRouter initialEntries={['/lab/face']}>
      <FaceScanRoute deps={deps} debug={false} />
    </MemoryRouter>,
  );
}

async function scan() {
  fireEvent.click(screen.getByRole('button', { name: /Start 3-second scan/ }));
  await screen.findByRole('heading', { name: 'Result' }, SLOW);
}

const faceObs = async () =>
  (await db.observations.toArray())
    .filter((o) => o.signalId === 'face_fluid_index')
    .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt));

describe('Face fluid-shift scan flow', () => {
  it('first scan sets the reference (1.00), second scan 3 % wider → 1.03 "+3 %"; verdicts from the domain', async () => {
    const { deps, spec, track } = fakeFaceDeps({});
    const openSpy = vi.spyOn(deps, 'openCamera');
    renderRoute(deps);
    expect(screen.getByRole('heading', { level: 1, name: 'Face fluid-shift scan' })).toBeInTheDocument();
    expect(screen.getAllByText(EXPERIMENTAL).length).toBeGreaterThan(0);
    expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
    // explainer BEFORE the camera
    expect(screen.getByRole('heading', { name: /needs your camera/ })).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'How to scan' })).toBeInTheDocument();
    expect(within(screen.getByTestId('fs-reference')).getByText('not set yet')).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();

    // --- first scan → reference
    fireEvent.click(screen.getByRole('button', { name: /Start 3-second scan/ }));
    expect(await screen.findByText(PRIVACY_LINE)).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Result' }, SLOW);
    expect(track.stopped).toBe(true);
    expect(screen.getAllByText(REFERENCE_NAME).length).toBeGreaterThan(0);
    expect(screen.getByText(REFERENCE_EXPLAINER)).toBeInTheDocument();
    expect(screen.getByTestId('fs-index')).toHaveTextContent('1.00');
    expect(screen.getByText('Good quality')).toBeInTheDocument();
    expect(screen.getByText(TREND_ONLY)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save as reference scan' }));
    expect(await screen.findByText(/Saved to K\. Osei's health record/)).toHaveTextContent(NO_IMAGE_LINE);
    const v1 = await screen.findByTestId('fs-verdict', {}, SLOW);
    // ISS-like weightless profile, mission day 143, index 1.00 → space NOMINAL; Earth n/a; personal disabled.
    expect(within(v1).getAllByText('Nominal').length).toBeGreaterThan(0);
    const first = await faceObs();
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      crewId: 'c3',
      value: 1,
      unit: '1',
      missionDay: 143,
      source: { kind: 'camera', method: 'face-geometry (MediaPipe landmarks)', label: 'MEASURED' },
      components: { cheekWidthRatio: 1, jawWidthRatio: 1, eyeApertureRatio: 1, referenceScan: 1 },
      quality: { label: 'good' },
    });
    const ref = loadReference('c3');
    expect(ref?.observationId).toBe(first[0]?.id);
    expect(ref?.features.cheekWidth).toBeCloseTo(130 / 60, 9);
    // only numbers in storage
    expect(localStorage.getItem(REFERENCE_KEY)).not.toMatch(/data:|base64|image/i);

    // --- second scan, cheek and jaw 3 % wider, a little further from the camera
    spec.current = { cheek: 130 * 1.03, jaw: 103, scale: 0.85 };
    fireEvent.click(screen.getByRole('button', { name: 'Scan again' }));
    await screen.findByRole('heading', { name: 'Result' }, SLOW);
    await waitFor(() => expect(screen.getByTestId('fs-index')).toHaveTextContent('1.03'));
    expect(screen.getByTestId('fs-index')).toHaveTextContent('+3%');
    expect(screen.queryByText(REFERENCE_EXPLAINER)).toBeNull();
    expect(screen.getByTestId('fs-ratios')).toHaveTextContent(/Cheek width relative to your reference:\s*\+3%/);
    expect(screen.getByTestId('fs-ratios')).toHaveTextContent(/Eye opening.*\+?0%/);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Saved to K\. Osei's health record/);
    const v2 = await screen.findByTestId('fs-verdict', {}, SLOW);
    await waitFor(() => expect(within(screen.getByTestId('fs-verdict')).getAllByText('Expected in space').length).toBeGreaterThan(0));
    expect(v2).toHaveTextContent(/3% above your pre-flight scans/);
    expect(screen.queryByText('Watch')).toBeNull();
    expect(screen.getByText(TREND_ONLY)).toBeInTheDocument();
    const all = await faceObs();
    expect(all.map((o) => o.value)).toEqual([1, 1.03]);
    expect(all[1]?.components).toMatchObject({ cheekWidthRatio: 1.03, jawWidthRatio: 1.03, referenceScan: 0 });
    // trend with both scans
    const trend = await screen.findByTestId('fs-trend');
    await waitFor(() => expect(within(trend).getAllByRole('listitem')).toHaveLength(2));
    expect(within(trend).getByText('Reference scan')).toBeInTheDocument();

    // privacy: nothing encoded or fetched
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('no face → poor quality, Save disabled, no "Save as poor quality" for a reference', async () => {
    const { deps } = fakeFaceDeps(null);
    renderRoute(deps);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await scan();
    expect(screen.getByText('Poor quality')).toBeInTheDocument();
    expect(screen.getByText('No steady face was found. Please retake the scan.')).toBeInTheDocument();
    expect(within(screen.getByTestId('fs-reasons')).getByText('no face found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as reference scan' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save as poor quality' })).toBeNull();
    expect(await faceObs()).toHaveLength(0);
  });

  it('head turned 11° → poor ("head turned"); with a reference, "Save as poor quality" is offered', async () => {
    const { deps, spec } = fakeFaceDeps({});
    renderRoute(deps);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await scan();
    fireEvent.click(screen.getByRole('button', { name: 'Save as reference scan' }));
    await screen.findByText(/Saved to K\. Osei's health record/);
    // every frame turned 11° → nothing measurable, Save off
    spec.current = { yaw: 11 };
    fireEvent.click(screen.getByRole('button', { name: 'Scan again' }));
    await screen.findByRole('heading', { name: 'Result' }, SLOW);
    await waitFor(() => expect(screen.getByText('Poor quality')).toBeInTheDocument());
    expect(within(screen.getByTestId('fs-reasons')).getByText('head turned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save as poor quality' })).toBeNull();
    // two of three frames turned 11°, one straight → measurable but poor: Save off, "Save as poor quality" on
    spec.current = (i) => (i % 3 === 0 ? {} : { yaw: 11 });
    fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
    await screen.findByRole('heading', { name: 'Result' }, SLOW);
    await waitFor(() => expect(screen.getByTestId('fs-index')).toHaveTextContent('1.00'));
    expect(screen.getByText('Poor quality')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save as poor quality' }));
    expect(await screen.findByText(/\(marked poor quality\)/)).toBeInTheDocument();
    const saved = await faceObs();
    expect(saved.map((o) => o.quality.label)).toEqual(['good', 'poor']);
    expect(saved[1]?.quality.reasons).toEqual(['head turned', 'too few steady frames']);
  });

  it('Reset reference clears it; the next scan becomes the new reference', async () => {
    const { deps } = fakeFaceDeps({});
    renderRoute(deps);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await scan();
    fireEvent.click(screen.getByRole('button', { name: 'Save as reference scan' }));
    await screen.findByText(/Saved to K\. Osei's health record/);
    expect(loadReference('c3')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset reference' }));
    expect(loadReference('c3')).toBeNull();
    expect(localStorage.getItem(REFERENCE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Scan again' }));
    await screen.findByRole('heading', { name: 'Result' }, SLOW);
    expect(screen.getByRole('button', { name: 'Save as reference scan' })).toBeEnabled();
  });

  it('a stored reference whose observation is gone (Reset demo) does not count', async () => {
    localStorage.setItem(
      REFERENCE_KEY,
      JSON.stringify({ c3: { crewId: 'c3', features: { cheekWidth: 2, jawWidth: 1.6, eyeAperture: 0.2 }, missionDay: 100, quality: { label: 'good', score: 1 }, observationId: 'gone', savedAt: '2026-11-01T00:00:00Z' } }),
    );
    const { deps } = fakeFaceDeps({});
    renderRoute(deps);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(within(screen.getByTestId('fs-reference')).getByText('not set yet')).toBeInTheDocument());
    await scan();
    expect(screen.getByRole('button', { name: 'Save as reference scan' })).toBeEnabled();
  });
});
