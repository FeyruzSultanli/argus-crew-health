// /lab and /lab/:flow — switches on `flow` only. Hub and flows live in their folders (doc 09, doc 11 §5.4).
import { useParams } from 'react-router';

import { CameraPulseRoute } from './camera/CameraPulseRoute';
import { FaceScanRoute } from './face/FaceScanEntry';
import { ComingNextPage } from './hub/ComingNext';
import { LabHub } from './hub/LabHub';
import { isComingNext } from './hub/tiles';
import { ManualVitalsRoute } from './manual/ManualVitalsRoute';
import { ReactionTestRoute } from './pvt/ReactionTestRoute';
import { VisionCheckLazy } from './vision/VisionCheckLazy';

export default function LabPage() {
  const { flow } = useParams();
  if (flow === 'camera') return <CameraPulseRoute />;
  if (flow === 'pvt') return <ReactionTestRoute />;
  if (flow === 'manual') return <ManualVitalsRoute />;
  if (flow === 'vision') return <VisionCheckLazy />;
  if (flow === 'face') return <FaceScanRoute />;
  if (flow && isComingNext(flow)) return <ComingNextPage flow={flow} />;
  return <LabHub />;
}
