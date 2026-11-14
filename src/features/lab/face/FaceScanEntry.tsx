// /lab/face entry, imported by LabPage: behind featureFlags.faceFluidScan (off → the static "Coming next" card) and
// lazy-loaded so the face-scan code stays out of the Lab chunk until the route is opened.
import { Suspense, lazy } from 'react';

import { featureFlags } from '../../../config/featureFlags';
import { RouteLoading } from '../../../ui';
import { ComingNextPage } from '../hub/ComingNext';

const LazyFaceScanRoute = lazy(() => import('./FaceScanRoute').then((m) => ({ default: m.FaceScanRoute })));

export function FaceScanRoute({ enabled = featureFlags.faceFluidScan }: { enabled?: boolean }) {
  if (!enabled) return <ComingNextPage flow="face" />;
  return (
    <Suspense fallback={<RouteLoading />}>
      <LazyFaceScanRoute />
    </Suspense>
  );
}
