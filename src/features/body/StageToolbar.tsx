import { Box, Minus, Plus, RotateCcw, Square } from 'lucide-react';

import type { BodySystemFilter } from '../../state/ui';
import { Button } from '../../ui/Button';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { cx } from '../../ui/tone';
import type { BodyZone } from './regions';
import { BODY_ZONES, SYSTEM_FILTERS } from './regions';

export type ViewMode = '3d' | '2d';

export interface StageToolbarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  webglAvailable: boolean;
  onZone: (z: BodyZone | 'home') => void;
  onZoom: (dir: 1 | -1) => void;
  filter: BodySystemFilter;
  onFilter: (f: BodySystemFilter) => void;
}

/** Centre toolbar: 3D/2D, region quick-jumps, zoom (3D only) and the system filter chips (FR-BODY-3). */
export function StageToolbar({
  view,
  onViewChange,
  webglAvailable,
  onZone,
  onZoom,
  filter,
  onFilter,
}: StageToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {webglAvailable && (
          <SegmentedControl
            label="Body view"
            value={view}
            onChange={onViewChange}
            options={[
              { value: '3d', label: '3D', icon: Box },
              { value: '2d', label: '2D', icon: Square },
            ]}
          />
        )}
        {view === '3d' && (
          <>
            <div role="group" aria-label="Jump to region" className="flex flex-wrap gap-1">
              {BODY_ZONES.map((z) => (
                <Button key={z.id} variant="ghost" onClick={() => onZone(z.id)} className="px-3">
                  {z.label}
                </Button>
              ))}
              <Button variant="ghost" icon={RotateCcw} iconOnly onClick={() => onZone('home')}>
                Reset view
              </Button>
            </div>
            <div role="group" aria-label="Zoom" className="flex gap-1">
              <Button variant="secondary" icon={Plus} iconOnly onClick={() => onZoom(1)}>
                Zoom in
              </Button>
              <Button variant="secondary" icon={Minus} iconOnly onClick={() => onZoom(-1)}>
                Zoom out
              </Button>
            </div>
          </>
        )}
      </div>
      <div role="group" aria-label="Body systems" className="flex flex-wrap gap-1.5">
        {SYSTEM_FILTERS.map((f) => {
          const on = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={on}
              onClick={() => onFilter(f.value)}
              className={cx(
                'inline-flex min-h-target min-w-target items-center justify-center rounded-pill border px-3 text-sm transition-colors duration-200 ease-out',
                on
                  ? 'border-brand bg-surface-2 font-medium text-text'
                  : 'border-border text-text-2 hover:text-text',
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
