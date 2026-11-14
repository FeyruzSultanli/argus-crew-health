import { Component, Suspense, lazy, useState } from 'react';
import type { ReactNode } from 'react';

import type { BodyRegionId, CrewMember } from '../../domain/types';
import { useReducedMotionPreference } from '../../state/hooks';
import { useUiStore } from '../../state/ui';
import { Skeleton } from '../../ui/States';
import { BodyFallbackSvg } from './BodyFallbackSvg';
import type { Hotspot } from './hotspots';
import type { BodyZone } from './regions';
import { RegionList } from './RegionList';
import type { ViewMode } from './StageToolbar';

/** A camera command for the 3D scene; `seq` changes on every request so repeats are honoured. */
export type CameraRequest =
  | { kind: 'home'; seq: number }
  | { kind: 'zone'; zone: BodyZone; seq: number }
  | { kind: 'region'; region: BodyRegionId; seq: number }
  | { kind: 'zoom'; dir: 1 | -1; seq: number };

/** A camera request before it gets its sequence number. */
export type CameraInput = CameraRequest extends infer T
  ? T extends { seq: number }
    ? Omit<T, 'seq'>
    : never
  : never;

// three.js, R3F and drei load only when the 3D view is shown (doc 05 §10 code split).
const BodyScene = lazy(() => import('../../three/BodyScene').then((m) => ({ default: m.BodyScene })));

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface BodyViewportProps {
  view: ViewMode;
  sex: CrewMember['sex'];
  hotspots: readonly Hotspot[];
  onRegion: (id: BodyRegionId) => void;
  camera: CameraRequest;
  missionDay: number;
}

/** 3D scene (lazy) with a keyboard region list, or the 2D silhouette (WebGL unavailable, failure or user choice). */
export function BodyViewport({ view, sex, hotspots, onRegion, camera }: BodyViewportProps) {
  const reduced = useReducedMotionPreference();
  const theme = useUiStore((s) => s.theme);
  const [failed, setFailed] = useState(false);

  if (view === '2d' || failed) {
    return (
      <div className="absolute inset-0 p-2" data-view="2d">
        {failed && (
          <p role="status" className="absolute top-2 left-3 text-xs text-text-3">
            3D view unavailable; showing the 2D body.
          </p>
        )}
        <BodyFallbackSvg hotspots={hotspots} onSelect={onRegion} sexLabel={sex} />
      </div>
    );
  }
  return (
    <div className="absolute inset-0" data-view="3d">
      <SceneBoundary onError={() => setFailed(true)}>
        <Suspense
          fallback={<Skeleton variant="block" label="Loading the 3D body" className="absolute inset-4" />}
        >
          <BodyScene
            sex={sex}
            hotspots={hotspots}
            onRegion={onRegion}
            camera={camera}
            reducedMotion={reduced}
            theme={theme}
            onFailure={() => setFailed(true)}
          />
        </Suspense>
      </SceneBoundary>
      <RegionList hotspots={hotspots} onSelect={onRegion} />
    </div>
  );
}
