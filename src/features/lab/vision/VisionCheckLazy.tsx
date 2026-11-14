// The only vision file in the Lab chunk: the vision check itself loads on first visit of /lab/vision.
import { Suspense, lazy } from 'react';

import { RouteLoading } from '../../../ui';

const VisionCheckRoute = lazy(() => import('./VisionCheckRoute').then((m) => ({ default: m.VisionCheckRoute })));

export function VisionCheckLazy() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <VisionCheckRoute />
    </Suspense>
  );
}
