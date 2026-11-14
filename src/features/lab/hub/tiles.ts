// The six Lab hub tiles (doc 09 intro, doc 11 §5.4).
import { Activity, Eye, FileUp, PenLine, ScanFace, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { featureFlags } from '../../../config/featureFlags';
import type { SignalId, SourceKind } from '../../../domain/types';

export type TileId = 'camera' | 'pvt' | 'manual' | 'vision' | 'import' | 'face';

export interface TileDef {
  id: TileId;
  title: string;
  what: string;
  priority: 'P0' | 'P1' | 'P2';
  icon: LucideIcon;
  /** Duration estimate shown through <Value>; omitted → "self-paced". */
  duration?: { value: number; unit: 's' | 'min'; sourceIds: readonly string[] };
  /** Signals whose latest reading is "last measured" on this tile. */
  signals: readonly SignalId[];
  /** Only readings from these source kinds count (e.g. camera readings for the camera tile); undefined → any. */
  kinds?: readonly SourceKind[];
  live: boolean;
  experimental?: boolean;
}

export const TILES: readonly TileDef[] = [
  {
    id: 'camera',
    title: 'Camera pulse',
    what: 'Resting pulse from the laptop camera.',
    priority: 'P0',
    icon: Activity,
    // 30-s capture window of doc 09 §1 (a measurement setting of this prototype)
    duration: { value: 30, unit: 's', sourceIds: ['SRC_DEMO_QUALITY_SCORES'] },
    signals: ['heart_rate_rest'],
    kinds: ['camera'],
    live: true,
  },
  {
    id: 'pvt',
    title: 'Reaction Self-Test',
    what: 'Psychomotor vigilance, modeled on the 3-minute PVT-B.',
    priority: 'P0',
    icon: Timer,
    duration: { value: 3, unit: 'min', sourceIds: ['SRC_PVT_B_BASNER2011'] },
    signals: ['reaction_test'],
    live: true,
  },
  {
    id: 'manual',
    title: 'Manual vitals',
    what: 'Blood pressure, SpO₂, temperature, glucose, mass, sleep, mood, symptoms.',
    priority: 'P0',
    icon: PenLine,
    signals: ['blood_pressure', 'heart_rate_rest', 'spo2', 'body_temp', 'glucose', 'body_mass', 'sleep_duration', 'mood', 'symptoms'],
    kinds: ['manual'],
    live: true,
  },
  { id: 'vision', title: 'Vision check', what: 'Amsler grid and near acuity on this screen.', priority: 'P1', icon: Eye, signals: ['amsler', 'near_acuity'], live: true },
  { id: 'import', title: 'Device import', what: 'CSV or JSON from wearables and dosimeters.', priority: 'P1', icon: FileUp, signals: [], live: false },
  faceTile(featureFlags.faceFluidScan),
];

/** The face scan tile, live behind featureFlags.faceFluidScan (3-s capture of doc 09 §2, a demo setting). */
export function faceTile(enabled: boolean): TileDef {
  const base = { id: 'face', title: 'Face fluid-shift scan', priority: 'P2', icon: ScanFace, experimental: true } as const;
  if (!enabled) return { ...base, what: 'Facial geometry vs your own pre-flight scans.', signals: [], live: false };
  return {
    ...base,
    what: 'Facial geometry vs your own reference scan. Trend only.',
    duration: { value: 3, unit: 's', sourceIds: ['SRC_DEMO_QUALITY_SCORES'] },
    signals: ['face_fluid_index'],
    kinds: ['camera'],
    live: true,
  };
}

// 'vision' stays in the type for ComingNext.tsx's card text, but it is live and no longer "coming".
export type ComingFlow = 'vision' | 'import' | 'face';
const COMING_FLOWS: readonly ComingFlow[] = ['import', 'face'];

/** Flows that show the static "Coming next" card; 'face' only while its feature flag is off. */
export function comingFlows(faceScanEnabled: boolean): readonly ComingFlow[] {
  return COMING_FLOWS.filter((f) => f !== 'face' || !faceScanEnabled);
}

export function isComingNext(flow: string): flow is ComingFlow {
  return (comingFlows(featureFlags.faceFluidScan) as readonly string[]).includes(flow);
}
