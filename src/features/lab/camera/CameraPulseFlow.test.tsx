// Flow test: explainer → how-to → capture → result → Save with a fake MediaStream and a mocked
// landmarker; asserts the saved observation shape and that no frame data is encoded, fetched or stored.
import { act, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CameraError } from '../../../measurement/rppg/capture';
import { CameraPulseFlow } from './CameraPulseFlow';
import { PRIVACY_LINE } from './copy';
import { fakeDeps } from './testDeps';

const RESULT_TIMEOUT = { timeout: 15_000 };

/** The flow uses router links (manual-entry pointer), so it renders inside a router. */
const render = (ui: ReactElement) => rtlRender(<MemoryRouter initialEntries={['/lab/camera']}>{ui}</MemoryRouter>);

let spies: Array<ReturnType<typeof vi.spyOn>> = [];
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
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

async function runToResult(pulseHz = 1.2, extra: Partial<Parameters<typeof CameraPulseFlow>[0]> = {}) {
  const onSave = vi.fn(() => Promise.resolve({ id: 'x' }));
  const { deps, track } = fakeDeps({ pulseHz });
  const openSpy = vi.spyOn(deps, 'openCamera');
  const view = render(
    <CameraPulseFlow crewId="c3" crewName="K. Osei" missionDay={143} onSave={onSave} deps={deps} debug={false} {...extra} />,
  );
  expect(screen.getByText(/Measuring:/)).toHaveTextContent('Measuring: K. Osei');
  // 1. Permission explainer BEFORE any camera request
  expect(screen.getByRole('heading', { name: /needs your camera/i })).toBeInTheDocument();
  expect(openSpy).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  // 2. How-to
  expect(screen.getByRole('heading', { name: 'How to measure' })).toBeInTheDocument();
  expect(openSpy).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Start 30-second measurement/ }));
  expect(openSpy).toHaveBeenCalledTimes(1);
  // 3. Live view with the exact privacy line
  expect(await screen.findByText(PRIVACY_LINE)).toBeInTheDocument();
  // 4. Result
  await screen.findByRole('heading', { name: 'Result' }, RESULT_TIMEOUT);
  return { onSave, track, view };
}

describe('CameraPulseFlow', () => {
  it('runs explainer → how-to → capture → result → Save and saves the observation shape', async () => {
    const { onSave, track } = await runToResult(1.2);
    expect(screen.getByTestId('cp-bpm').dataset.bpm).toMatch(/^7[123]$/);
    // bpm renders through <Value> with the POS source badge and the MEASURED tag
    expect(screen.getByTestId('cp-bpm')).toHaveTextContent('bpm');
    expect(screen.getByTestId('cp-bpm')).toHaveTextContent('MEASURED');
    expect(screen.getByText('Good quality')).toBeInTheDocument();
    expect(track.stopped).toBe(true); // camera released as soon as the result is in
    expect(screen.queryByText(/simulated baseline/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = (onSave.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(Object.keys(saved).sort()).toEqual(['crewId', 'missionDay', 'quality', 'signalId', 'source', 'unit', 'value']);
    expect(saved).toMatchObject({
      crewId: 'c3',
      signalId: 'heart_rate_rest',
      unit: '/min',
      missionDay: 143,
      source: { kind: 'camera', method: 'rPPG-POS', label: 'MEASURED' },
      quality: { label: 'good', reasons: [] },
    });
    expect(Number.isInteger(saved.value)).toBe(true);
    expect(Math.abs((saved.value as number) - 72)).toBeLessThanOrEqual(1);
    expect(await screen.findByText(/Saved to K\. Osei's health record/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Measure again' })).toBeInTheDocument();

    // Privacy: nothing encoded an image or hit the network.
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30_000);

  it('poor quality disables Save and offers "Save as poor quality"', async () => {
    const { onSave } = await runToResult(0);
    expect(screen.getByText('Poor quality')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save as poor quality' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect((onSave.mock.calls[0] as unknown[])[0]).toMatchObject({ quality: { label: 'poor' } });
    expect(await screen.findByText(/marked poor quality/)).toBeInTheDocument();
  }, 30_000);

  it('shows the compare band when the usual range is given', async () => {
    await runToResult(1.2, { usual: { lo: 60, hi: 70 } });
    expect(screen.getByText("Compared with K. Osei's simulated baseline")).toBeInTheDocument();
  }, 30_000);

  it('formats the usual band through <Value precision> and shows the evaluation only after Save', async () => {
    await runToResult(1.2, {
      usual: { lo: 61.199999999, hi: 69.80000001 },
      renderEvaluation: ({ saved }) => <p>{saved ? 'verdict block' : 'never before save'}</p>,
    });
    const band = screen.getByTestId('cp-usual');
    expect(band).toHaveTextContent('61');
    expect(band).toHaveTextContent('70');
    expect(band).not.toHaveTextContent('61.19');
    expect(band).toHaveTextContent('SIMULATED');
    expect(screen.queryByText('verdict block')).toBeNull();
    expect(screen.queryByText('never before save')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('verdict block')).toBeInTheDocument();
    expect(screen.getByText("Compared with K. Osei's simulated baseline")).toBeInTheDocument();
  }, 30_000);

  it('shows an honest error when saving fails', async () => {
      const { deps } = fakeDeps();
    const onSave = vi.fn(() => Promise.reject(new Error('heart_rate_rest: value 300 outside valid input range 25–220')));
    render(<CameraPulseFlow crewId="c3" crewName="K. Osei" missionDay={143} onSave={onSave} deps={deps} debug={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /Start 30-second/ }));
    await screen.findByRole('heading', { name: 'Result' }, RESULT_TIMEOUT);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Not saved: heart_rate_rest: value 300 outside valid input range/)).toBeInTheDocument();
  }, 30_000);

  it('camera denied → clear error with retry and a pointer to manual entry', async () => {
      const { deps } = fakeDeps({ openCamera: () => Promise.reject(new CameraError('denied', 'Camera access was blocked.')) });
    render(<CameraPulseFlow crewId="c3" crewName="K. Osei" missionDay={143} onSave={vi.fn()} deps={deps} debug={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /Start 30-second/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Camera access is blocked');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Enter pulse manually/ })).toHaveAttribute('href', '/lab/manual');
  });

  it('stops all camera tracks when unmounted mid-capture', async () => {
      const { deps, track } = fakeDeps();
    deps.startLoop = () => () => {}; // never delivers frames → stays live
    const view = render(
      <CameraPulseFlow crewId="c3" crewName="K. Osei" missionDay={143} onSave={vi.fn()} deps={deps} debug />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /Start 30-second/ }));
    expect(await screen.findByText(PRIVACY_LINE)).toBeInTheDocument();
    await screen.findByRole('button', { name: /Cancel measurement/ });
    expect(screen.getByTestId('rppg-debug')).toBeInTheDocument();
    expect(track.stopped).toBe(false);
    act(() => view.unmount());
    expect(track.stopped).toBe(true);
  });
});
