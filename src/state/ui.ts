// UI store (doc 05 §5): selection, lenses, preferences, and the two shell feeds the services write into
// (scrubber flag density, space-weather badge mode). Preferences are persisted; selections are transient.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LayerId, SignalDef, SignalId, SpaceWeatherState } from '../domain/types';

export type Theme = 'dark' | 'light' | 'hc';
export type LayerLens = 'combined' | LayerId;
export type BodySystemFilter = SignalDef['system'] | 'all';
export type TempUnit = 'Cel' | '[degF]';
export type GlucoseUnit = 'mg/dL' | 'mmol/L';
export type SpaceWeatherMode = SpaceWeatherState['mode'];

/** One mission day in the scrubber: count of signals in WATCH and in ACT that day (all visible crew). */
export interface FlagDensityDay {
  missionDay: number;
  watch: number;
  act: number;
}

/** Header collapses to a thin bar with "Exit" while a Lab flow runs (doc 11 §5.4). */
export interface FocusedFlow {
  title: string;
  /** Where "Exit" goes, e.g. '/lab'. */
  exitTo: string;
}

export interface UiState {
  selectedCrewId: string | null;
  selectedSignalId: SignalId | null;
  layerLens: LayerLens;
  bodySystemFilter: BodySystemFilter;
  theme: Theme;
  gloveMode: boolean;
  /** User setting; the OS `prefers-reduced-motion` is honoured independently (see useReducedMotionPreference). */
  reducedMotion: boolean;
  units: { temp: TempUnit; glucose: GlucoseUnit };
  focusedFlow: FocusedFlow | null;
  /** Scrubber bars. Empty until the health service feeds it (setFlagDensity). */
  flagDensity: FlagDensityDay[];
  /** Space-weather badge. 'SNAPSHOT' until the space-weather service reports the real mode. */
  spaceWeatherMode: SpaceWeatherMode;
  setSelectedCrew: (id: string | null) => void;
  setSelectedSignal: (id: SignalId | null) => void;
  setLayerLens: (lens: LayerLens) => void;
  setBodySystemFilter: (f: BodySystemFilter) => void;
  setTheme: (t: Theme) => void;
  setGloveMode: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
  setUnits: (u: Partial<UiState['units']>) => void;
  setFocusedFlow: (f: FocusedFlow | null) => void;
  setFlagDensity: (d: FlagDensityDay[]) => void;
  setSpaceWeatherMode: (m: SpaceWeatherMode) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      selectedCrewId: null,
      selectedSignalId: null,
      layerLens: 'combined',
      bodySystemFilter: 'all',
      theme: 'dark',
      gloveMode: false,
      reducedMotion: false,
      units: { temp: 'Cel', glucose: 'mg/dL' },
      focusedFlow: null,
      flagDensity: [],
      spaceWeatherMode: 'SNAPSHOT',
      setSelectedCrew: (id) => set({ selectedCrewId: id }),
      setSelectedSignal: (id) => set({ selectedSignalId: id }),
      setLayerLens: (lens) => set({ layerLens: lens }),
      setBodySystemFilter: (f) => set({ bodySystemFilter: f }),
      setTheme: (t) => set({ theme: t }),
      setGloveMode: (on) => set({ gloveMode: on }),
      setReducedMotion: (on) => set({ reducedMotion: on }),
      setUnits: (u) => set({ units: { ...get().units, ...u } }),
      setFocusedFlow: (f) => set({ focusedFlow: f }),
      setFlagDensity: (d) => set({ flagDensity: d }),
      setSpaceWeatherMode: (m) => set({ spaceWeatherMode: m }),
    }),
    {
      name: 'argus.ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only preferences survive a reload; selections, feeds and the focused flow are per session.
      partialize: (s) => ({
        theme: s.theme,
        gloveMode: s.gloveMode,
        reducedMotion: s.reducedMotion,
        units: s.units,
      }),
    },
  ),
);
