import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockOseiHeartRateAct, mockSleepExpected } from '../test/fixtures';
import type { Verdict } from '../domain/types';
import { LayerTriad } from './LayerTriad';
import { SourceDrawerProvider } from './SourceDrawer';
import { worstStatus } from './sources';
import { StatusPill } from './StatusPill';
import { Value } from './Value';

describe('StatusPill', () => {
  it.each<[Verdict, string, string]>([
    ['NOMINAL', 'Nominal', 'lucide-circle-check'],
    ['EXPECTED', 'Expected in space', 'lucide-orbit'],
    ['WATCH', 'Watch', 'lucide-eye'],
    ['ACT', 'Act', 'lucide-triangle'],
    ['NO_DATA', 'No data', 'lucide-circle-dashed'],
  ])('%s shows the word "%s" and its icon', (verdict, word, iconClass) => {
    const { container } = render(<StatusPill verdict={verdict} />);
    expect(screen.getByText(word)).toBeInTheDocument();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain(iconClass);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Value', () => {
  it('worst status wins: demo > partial > verified', () => {
    expect(worstStatus(['SRC_STD3001_CO2'])).toBe('verified');
    expect(worstStatus(['SRC_STD3001_CO2', 'SRC_CO2_ICES_LIMITS'])).toBe('partial');
    expect(worstStatus(['SRC_CO2_ICES_LIMITS', 'SRC_DEMO_RULE_BANDS', 'SRC_STD3001_CO2'])).toBe('demo');
    expect(worstStatus([])).toBe('demo');
    expect(worstStatus(['unregistered-id'])).toBe('partial');
  });

  it.each([
    [['SRC_STD3001_CO2'], 'verified', '✓'],
    [['SRC_CO2_ICES_LIMITS'], 'partial', '~'],
    [['SRC_STD3001_CO2', 'SRC_DEMO_RULE_BANDS'], 'demo', 'D'],
  ])('badge for %j is %s (%s)', (ids, status, glyph) => {
    const { container } = render(
      <SourceDrawerProvider>
        <Value value={3} unit="mm[Hg]" sourceIds={ids} />
      </SourceDrawerProvider>,
    );
    const badge = container.querySelector(`[data-source-status="${status}"]`);
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain(glyph);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('mmHg')).toBeInTheDocument();
  });

  it('a demo source shows the "Demo parameter" tag on focus and in the drawer on click', () => {
    render(
      <SourceDrawerProvider>
        <Value
          value={69}
          unit="/min"
          sourceIds={['SRC_DEMO_BASELINE_ENGINE']}
          title="Resting heart rate"
          freshness="3 h"
          label="SIMULATED"
        />
      </SourceDrawerProvider>,
    );
    const button = screen.getByRole('button', { name: 'Sources: Demo parameter' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(tooltip).not.toBeVisible();
    fireEvent.focus(button);
    expect(tooltip).toBeVisible();
    expect(within(tooltip).getAllByText('Demo parameter').length).toBeGreaterThan(0);
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Sources' });
    expect(within(dialog).getByText('Demo parameter')).toBeInTheDocument();
    expect(screen.getByText('SIMULATED')).toBeInTheDocument();
    expect(screen.getByText('3 h')).toBeInTheDocument();
  });

  it('renders no data as an em dash with a spoken "no data"', () => {
    render(<Value value={null} unit="mg/dL" sourceIds={['SRC_EARTH_GLUCOSE_ADA']} />);
    expect(screen.getByText('no data')).toBeInTheDocument();
  });

  it('non-interactive badge renders no button', () => {
    render(
      <SourceDrawerProvider>
        <Value value={11} unit="min" sourceIds={['SRC_DEMO_SIMULATION']} interactive={false} />
      </SourceDrawerProvider>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('LayerTriad', () => {
  it('compact: one named pill per layer, in P · S · E order', () => {
    render(<LayerTriad layers={mockOseiHeartRateAct.layers} drivenBy={mockOseiHeartRateAct.drivenBy} />);
    const group = screen.getByRole('group', { name: 'Layer verdicts' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Personal baseline: Act',
      'Space-adapted rules: Nominal',
      'Earth clinical reference: Nominal',
    ]);
  });

  it('compact: tap explains the layer with its reason', () => {
    render(<LayerTriad layers={mockSleepExpected.layers} drivenBy={mockSleepExpected.drivenBy} />);
    const space = screen.getByRole('button', { name: 'Space-adapted rules: Expected in space' });
    fireEvent.click(space);
    expect(space).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Typical in flight; protect your sleep.')).toBeVisible();
    expect(screen.getByText(/drove the verdict/)).toBeVisible();
  });

  it('expanded: three panels, driving layer marked, caught-only-by-personal marker', () => {
    render(
      <LayerTriad
        variant="expanded"
        layers={mockOseiHeartRateAct.layers}
        drivenBy={mockOseiHeartRateAct.drivenBy}
        caughtOnlyByPersonal
      />,
    );
    expect(screen.getByText('Caught only by personal baseline')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual([
      'Personal',
      'Space',
      'Earth',
    ]);
    expect(screen.getAllByText('drove verdict')).toHaveLength(1);
    expect(screen.getByText('5.5')).toBeInTheDocument();
    expect(screen.getByText('11.5')).toBeInTheDocument();
  });
});
