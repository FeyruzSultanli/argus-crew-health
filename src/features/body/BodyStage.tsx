import { Watch } from 'lucide-react';

import type { Assessment, BodyRegionId, CrewMember } from '../../domain/types';
import type { BodySystemFilter } from '../../state/ui';
import { cx } from '../../ui/tone';
import { BodyViewport } from './BodyViewport';
import type { CameraInput, CameraRequest } from './BodyViewport';
import type { Hotspot } from './hotspots';
import { LatestValue } from './LatestValue';
import { StageToolbar } from './StageToolbar';
import type { ViewMode } from './StageToolbar';

export const CREDIT_CAPTION =
  'Reference body, not a scan of this person: HRA 3D Reference Organs (Visible Human), HuBMAP, CC BY 4.0.';

export interface BodyStageProps {
  member: CrewMember;
  assessments: readonly Assessment[];
  hotspots: readonly Hotspot[];
  onRegion: (id: BodyRegionId) => void;
  camera: CameraRequest;
  onCamera: (r: CameraInput) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  webglAvailable: boolean;
  filter: BodySystemFilter;
  onFilter: (f: BodySystemFilter) => void;
  missionDay: number;
  overlay?: React.ReactNode;
  className?: string;
}

/** Centre column (doc 11 §5.2): name + role, simulated wearable chip, toolbar, body view, credit caption. */
export function BodyStage(props: BodyStageProps) {
  const { member, assessments, view, webglAvailable } = props;
  const hr = assessments.find((a) => a.signalId === 'heart_rate_rest');
  const spo2 = assessments.find((a) => a.signalId === 'spo2');
  return (
    <section
      aria-labelledby="body-subject"
      className={cx('flex min-h-0 min-w-0 flex-col gap-3 p-3 xl:p-4', props.className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 id="body-subject" className="text-2xl font-semibold text-text">
            {member.displayName}
          </h1>
          <p className="text-sm text-text-2">
            {member.role}
            {member.isCMO ? ' · Crew Medical Officer' : ''}
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-dashed border-border-strong bg-surface-1 px-3 py-1.5"
          aria-label="Wearable (simulated)"
          role="group"
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-text-2 uppercase">
            <Watch size={14} aria-hidden="true" /> Wearable · simulated
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-text-3">
            HR {hr ? <LatestValue assessment={hr} size="sm" /> : '—'}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-text-3">
            SpO₂ {spo2 ? <LatestValue assessment={spo2} size="sm" /> : '—'}
          </span>
        </div>
      </header>
      <StageToolbar
        view={view}
        onViewChange={props.onViewChange}
        webglAvailable={webglAvailable}
        onZone={(z) => props.onCamera(z === 'home' ? { kind: 'home' } : { kind: 'zone', zone: z })}
        onZoom={(dir) => props.onCamera({ kind: 'zoom', dir })}
        filter={props.filter}
        onFilter={props.onFilter}
      />
      {/* min-h 384 px: the 2D map scales its 56-unit labels by min(w/480, h/460); 384 − 18 px padding/border keeps
          them ≥ 44 px tall (at 360 px they rendered 43 px on the 1024×768 tablet once real data wrapped the header). */}
      <div className="relative min-h-[384px] flex-1 overflow-hidden rounded-card border border-border bg-[radial-gradient(ellipse_at_50%_40%,var(--surface-2),var(--bg)_70%)]">
        <BodyViewport
          view={view}
          sex={member.sex}
          hotspots={props.hotspots}
          onRegion={props.onRegion}
          camera={props.camera}
          missionDay={props.missionDay}
        />
        {props.overlay}
      </div>
      <p className="text-xs text-text-3" data-testid="credit-caption">
        {CREDIT_CAPTION}
      </p>
    </section>
  );
}
