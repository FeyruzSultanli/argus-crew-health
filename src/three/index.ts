// 3D body (doc 11 §6). Import BodyScene lazily (React.lazy) so three.js stays in its own chunk.
export {
  ORGAN_NODE_IDS,
  REGION_NODES,
  NODE_REGION,
  REGION_ANCHORS,
  HOME_VIEW,
  ZONE_VIEWS,
} from './anatomyMap';
export type { OrganNodeId, Vec3, CameraView } from './anatomyMap';
