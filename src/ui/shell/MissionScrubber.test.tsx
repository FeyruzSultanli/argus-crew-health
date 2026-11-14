import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { mockFlagDensity } from '../../test/fixtures';
import { useMissionStore } from '../../state/mission';
import { MissionScrubber } from './MissionScrubber';

function setup(day = 143) {
  useMissionStore.setState({ profileId: 'mars-transit', missionDay: day });
  render(<MissionScrubber density={mockFlagDensity} />);
  return screen.getByRole('slider', { name: 'Mission day' });
}

const day = () => useMissionStore.getState().missionDay;

beforeEach(() => localStorage.clear());

describe('MissionScrubber keyboard', () => {
  it('exposes slider semantics', () => {
    const slider = setup();
    expect(slider).toHaveAttribute('aria-valuemin', '-180');
    expect(slider).toHaveAttribute('aria-valuemax', '143');
    expect(slider).toHaveAttribute('aria-valuenow', '143');
    expect(slider.getAttribute('aria-valuetext')).toMatch(
      /^Mission day 143, today, 2 act and 1 watch flags$/,
    );
  });

  it('←/→ move one day and clamp at today', () => {
    const slider = setup();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(day()).toBe(143);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(day()).toBe(142);
    expect(slider).toHaveAttribute('aria-valuenow', '142');
  });

  it('Shift+←/→ move one week', () => {
    const slider = setup(143);
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true });
    expect(day()).toBe(136);
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    expect(day()).toBe(143);
  });

  it('skips day 0 across launch, both ways and by week', () => {
    const slider = setup(1);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(day()).toBe(-1);
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(day()).toBe(1);
    useMissionStore.setState({ missionDay: -3 });
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    expect(day()).toBe(5);
  });

  it('Home/End jump to L-180 and today; clamps at L-180', () => {
    const slider = setup();
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(day()).toBe(-180);
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true });
    expect(day()).toBe(-180);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(day()).toBe(143);
  });

  it('prev/next buttons step and "Today" returns', () => {
    setup(10);
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(day()).toBe(11);
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(day()).toBe(9);
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(day()).toBe(143);
  });
});
