// Browser glue for the PVT engine: rAF loop on performance.now(), key/tap input, tab-hidden / window-blur pause,
// paint-timed onset. In test mode the same engine runs on a virtual clock with scripted responses (no input,
// no focus handling) so a 180-s session completes in well under a second.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type ManualClock,
  type PvtClock,
  PvtEngine,
  type PvtSnapshot,
  type ScriptedDriver,
  createManualClock,
  createScriptedDriver,
} from '../../../measurement/pvt';
import { type PvtTestMode, newSessionSeed } from './testMode';

/** Keys that never count as a response: navigation/modifiers. Escape stops the test. */
const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'OS', 'ContextMenu']);
/** Virtual milliseconds advanced per 16-ms tick in test mode (180 s ≈ 36 ticks). */
export const TEST_MODE_CHUNK_MS = 5000;
const TEST_MODE_TICK_MS = 16;
/** A click with detail 0 this soon after a handled key is the browser's synthetic activation — ignore it. */
const KEY_CLICK_DEDUP_MS = 500;

const performanceClock: PvtClock = { now: () => performance.now() };

export interface PvtSession {
  snapshot: PvtSnapshot | null;
  /** Clock time of the latest render tick (for the counting stimulus). */
  now: number;
  running: boolean;
  start(): void;
  stop(): void;
  /** Tap target pointerdown. */
  respond(): void;
  /** Tap target click: only keyboard-less activations (e.g. screen reader) count; mouse/touch use pointerdown. */
  respondFromClick(detail: number): void;
  /** Called from a layout effect when the stimulus box is in the DOM; onset = next rAF timestamp. */
  notifyStimulusRendered(): void;
}

export function usePvtSession(testMode: PvtTestMode | null): PvtSession {
  const engineRef = useRef<PvtEngine | null>(null);
  const clockRef = useRef<PvtClock>(performanceClock);
  const driverRef = useRef<ScriptedDriver | null>(null);
  const lastKeyAtRef = useRef(-Infinity);
  const [snapshot, setSnapshot] = useState<PvtSnapshot | null>(null);
  const [now, setNow] = useState(0);
  const [running, setRunning] = useState(false);

  const sync = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    const s = e.snapshot();
    setSnapshot(s);
    setNow(clockRef.current.now());
    if (s.phase === 'done' || s.phase === 'aborted') setRunning(false);
  }, []);

  const start = useCallback(() => {
    const seed = testMode ? testMode.seed : newSessionSeed();
    if (testMode) {
      const clock: ManualClock = createManualClock(0);
      const engine = new PvtEngine({ clock, seed });
      clockRef.current = clock;
      engineRef.current = engine;
      driverRef.current = createScriptedDriver(engine, clock, testMode.profile, seed);
      engine.start();
    } else {
      clockRef.current = performanceClock;
      engineRef.current = new PvtEngine({ clock: performanceClock, seed });
      driverRef.current = null;
      engineRef.current.start();
    }
    sync();
    setRunning(true);
  }, [testMode, sync]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    sync();
  }, [sync]);

  const respond = useCallback(() => {
    if (driverRef.current) return; // scripted
    engineRef.current?.respond();
    sync();
  }, [sync]);

  const respondFromClick = useCallback(
    (detail: number) => {
      if (detail !== 0 || performance.now() - lastKeyAtRef.current < KEY_CLICK_DEDUP_MS) return;
      respond();
    },
    [respond],
  );

  const notifyStimulusRendered = useCallback(() => {
    if (driverRef.current) return; // the scripted driver paints on its virtual clock
    requestAnimationFrame((ts) => {
      engineRef.current?.markPainted(ts);
      sync();
    });
  }, [sync]);

  // Test mode: scripted responses on the virtual clock.
  useEffect(() => {
    if (!running || !driverRef.current) return;
    const driver = driverRef.current;
    const id = window.setInterval(() => {
      driver.step(TEST_MODE_CHUNK_MS);
      sync();
    }, TEST_MODE_TICK_MS);
    return () => window.clearInterval(id);
  }, [running, sync]);

  // Real mode: frame loop, input and focus handling.
  useEffect(() => {
    if (!running || driverRef.current) return;
    const engine = engineRef.current as PvtEngine;
    let raf = requestAnimationFrame(function loop() {
      engine.update();
      sync();
      raf = requestAnimationFrame(loop);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        engine.stop();
        sync();
        return;
      }
      if (e.repeat || IGNORED_KEYS.has(e.key)) return;
      e.preventDefault();
      lastKeyAtRef.current = performance.now();
      engine.respond();
      sync();
    };
    const lost = () => {
      engine.focusLost();
      sync();
    };
    const regained = () => {
      engine.focusRegained();
      sync();
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? lost() : regained());
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', lost);
    window.addEventListener('focus', regained);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', lost);
      window.removeEventListener('focus', regained);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [running, sync]);

  return { snapshot, now, running, start, stop, respond, respondFromClick, notifyStimulusRendered };
}
