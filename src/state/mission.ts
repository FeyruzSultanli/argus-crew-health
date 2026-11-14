// Mission store (doc 05 §5): profile, mission day, time compression, demo flags, replay. Persisted, global —
// it drives every screen. Mission-day rules: range [−180 … profile.demoMissionDay], no day 0.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { MissionProfileId } from '../domain/types';
import { DEFAULT_PROFILE_ID, clampMissionDay, getProfile, stepMissionDay } from './missionSelectors';

/** Demo switches (FR-SET-2). Set from the demo controls; defaults keep the demo calm. */
export interface DemoFlags {
  /** Demo controls visible (`?demo=1` or settings toggle). */
  controlsVisible: boolean;
}

/** Replay of a past event (e.g. an SPE). */
export interface ReplayState {
  active: boolean;
  /** What is replayed, e.g. 'spe-2024-05'. */
  id: string | null;
}

export interface MissionState {
  profileId: MissionProfileId;
  missionDay: number;
  /** Real seconds → demo seconds factor for Earth-link countdowns (1 = real time). */
  timeCompression: number;
  demo: DemoFlags;
  replay: ReplayState;
  /** Switch profile; mission day jumps to that profile's demo day. */
  setProfile: (id: MissionProfileId) => void;
  /** Clamped to [−180 … demoMissionDay]; day 0 becomes day 1. */
  setMissionDay: (day: number) => void;
  /** Move by real days, skipping day 0 (−1 → +1). */
  stepDay: (delta: number) => void;
  /** Back to the profile's demo day ("today"). */
  resetToToday: () => void;
  setTimeCompression: (factor: number) => void;
  setDemoFlags: (flags: Partial<DemoFlags>) => void;
  setReplay: (replay: Partial<ReplayState>) => void;
}

const defaultProfile = getProfile(DEFAULT_PROFILE_ID);

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      profileId: DEFAULT_PROFILE_ID,
      missionDay: defaultProfile.demoMissionDay,
      timeCompression: 60, // demo default: 11 min of Earth-link delay is shown as 11 s (SRC_DEMO_SIMULATION)
      demo: { controlsVisible: false },
      replay: { active: false, id: null },
      setProfile: (id) => set({ profileId: id, missionDay: getProfile(id).demoMissionDay }),
      setMissionDay: (day) => set({ missionDay: clampMissionDay(day, getProfile(get().profileId)) }),
      stepDay: (delta) =>
        set({ missionDay: stepMissionDay(get().missionDay, delta, getProfile(get().profileId)) }),
      resetToToday: () => set({ missionDay: getProfile(get().profileId).demoMissionDay }),
      setTimeCompression: (factor) => set({ timeCompression: factor > 0 ? factor : 1 }),
      setDemoFlags: (flags) => set({ demo: { ...get().demo, ...flags } }),
      setReplay: (replay) => set({ replay: { ...get().replay, ...replay } }),
    }),
    {
      name: 'argus.mission',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        profileId: s.profileId,
        missionDay: s.missionDay,
        timeCompression: s.timeCompression,
        demo: s.demo,
      }),
    },
  ),
);

/** The active MissionProfile object (re-renders only when the profile id changes). */
export function useMissionProfile() {
  return getProfile(useMissionStore((s) => s.profileId));
}
