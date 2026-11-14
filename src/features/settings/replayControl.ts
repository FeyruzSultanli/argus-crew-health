// Adapter between the Settings demo controls and the SPE replay engine (src/services/replay.ts).
// The replay plays the synthetic S2-class profile; every surface that shows it is labeled REPLAY (doc 10 §8).
import { setReplaySpeed, startReplay, stopReplay } from '../../services/replay';
import { useMissionStore } from '../../state/mission';

export const REPLAY_SPEEDS = [60, 600, 3600] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
/** seed/scenarios.json spe-event: speed 600. */
export const DEFAULT_REPLAY_SPEED: ReplaySpeed = 600;
/** Replay id written to the mission store (seed/radiation/spe-replay.json). */
export const SPE_REPLAY_ID = 'spe-replay';

export interface ReplayControl {
  /** False when no replay engine is available; the UI then links to /environment instead. */
  available: boolean;
  start: (speed: ReplaySpeed) => void;
  stop: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
}

let currentSpeed: ReplaySpeed = DEFAULT_REPLAY_SPEED;

export const replayControl: ReplayControl = {
  available: true,
  start: (speed) => {
    currentSpeed = speed;
    useMissionStore.getState().setReplay({ active: true, id: SPE_REPLAY_ID });
    void startReplay(speed);
  },
  stop: () => {
    useMissionStore.getState().setReplay({ active: false });
    stopReplay();
  },
  setSpeed: (speed) => {
    currentSpeed = speed;
    setReplaySpeed(speed);
  },
};

/** Speed last chosen (kept here because the store has no speed field). */
export function replaySpeed(): ReplaySpeed {
  return currentSpeed;
}
