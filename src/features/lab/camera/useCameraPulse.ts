// Capture session for the camera-pulse flow: camera → MediaPipe landmarks → ROI means → rPPG engine.
// Frames stay in memory (docs/PROJECT_RULES.md rule 7); only per-frame means go to the engine. All tracks stop on finish,
// on stop() and on unmount.
import { useCallback, useEffect, useRef, useState } from 'react';

import { CAPTURE_SEC } from '../../../measurement/rppg/accumulator';
import { CameraError, stopStream } from '../../../measurement/rppg/capture';
import type { RoiResult } from '../../../measurement/rppg/roi';
import type { RppgEstimate } from '../../../measurement/rppg/types';
import { type CameraPulseDeps, TrackerLoadError } from './deps';
import { drawOverlay } from './overlay';
import {
  EMPTY_LIVE,
  type LiveState,
  type Session,
  type SessionError,
  type SessionPhase,
  distanceOf,
  radialSd,
  waitForElement,
} from './session';

export function useCameraPulse(deps: CameraPulseDeps, opts: { debug: boolean; mirrored: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const session = useRef<Session | null>(null);
  const optsRef = useRef(opts);
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [live, setLive] = useState<LiveState>(EMPTY_LIVE);
  const [result, setResult] = useState<RppgEstimate | null>(null);
  const [error, setError] = useState<SessionError | null>(null);

  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const teardown = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.done = true;
    s.stopLoop?.();
    if (s.watchdog) clearTimeout(s.watchdog);
    s.engine?.dispose();
    stopStream(s.stream);
    const video = videoRef.current;
    if (video) video.srcObject = null;
    session.current = null;
  }, []);

  const fail = useCallback(
    (err: SessionError) => {
      teardown();
      setError(err);
      setPhase('error');
    },
    [teardown],
  );

  const start = useCallback(async () => {
    teardown();
    const s: Session = { stream: null, engine: null, stopLoop: null, watchdog: null, done: false };
    session.current = s;
    setError(null);
    setResult(null);
    setLive(EMPTY_LIVE);
    setPhase('starting');
    try {
      const [stream, tracker] = await Promise.all([
        deps.openCamera().then((st) => {
          s.stream = st;
          if (s.done) stopStream(st); // cancelled while the permission prompt was open
          return st;
        }),
        deps.loadTracker(),
      ]);
      if (s.done) return;
      const video = await waitForElement(() => videoRef.current);
      video.srcObject = stream;
      video.muted = true;
      try {
        await video.play();
      } catch {
        // autoplay of a muted inline video is allowed; a rejection here is not fatal
      }
      if (s.done) return;
      const engine = deps.createEngine();
      s.engine = engine;
      const reader = deps.createFrameReader();
      const hist = { ts: [] as number[], cx: [] as number[], cy: [] as number[] };
      let t0: number | null = null;
      let lastTs = 0;
      let lastUi = -Infinity;
      let ok = 0;
      let missed = 0;
      let lastRoi: RoiResult | null = null;
      let lastLum: number | null = null;
      let lastClip: number | null = null;

      engine.onEstimate((est) => {
        if (s.done) return;
        if (est.final) {
          teardown();
          setResult(est);
          setPhase('done');
        } else {
          setLive((prev) => ({ ...prev, estimate: est }));
        }
      });
      engine.post({ type: 'reset', durationSec: CAPTURE_SEC });

      const onFrame = (now: number) => {
        if (s.done) return;
        const ts = Math.max(now, lastTs + 1);
        lastTs = ts;
        if (t0 === null) t0 = ts;
        try {
          const res = reader.read(video, tracker.detect(video, ts), ts);
          lastRoi = res.roi;
          if (res.kind === 'frame') {
            ok++;
            lastLum = res.sample.lum;
            lastClip = res.sample.clip;
            hist.cx.push(res.sample.cx);
            hist.cy.push(res.sample.cy);
            if (hist.cx.length > 90) {
              hist.cx.shift();
              hist.cy.shift();
            }
            engine.post({ type: 'frame', ...res.sample });
          } else {
            missed++;
            engine.post({ type: 'miss', t: ts, reason: res.reason });
          }
        } catch (e) {
          fail({ kind: 'processing', message: e instanceof Error ? e.message : 'Frame processing failed.' });
          return;
        }
        hist.ts.push(ts);
        while (hist.ts.length > 0 && ts - (hist.ts[0] as number) > 1000) hist.ts.shift();
        const canvas = overlayRef.current;
        if (canvas) drawOverlay(canvas, lastRoi, optsRef.current);
        const elapsedSec = (ts - t0) / 1000;
        if (elapsedSec > CAPTURE_SEC + 3) engine.post({ type: 'finalize' });
        if (ts - lastUi >= 250) {
          lastUi = ts;
          const frac = lastRoi?.faceWidthFrac ?? 0;
          const faceFound = lastRoi?.ok ?? false;
          setLive((prev) => ({
            ...prev,
            elapsedSec: Math.min(elapsedSec, CAPTURE_SEC),
            lum: lastLum,
            clip: lastClip,
            faceFound,
            distance: lastRoi ? distanceOf(frac) : null,
            fps: hist.ts.length,
            motionPx: radialSd(hist.cx, hist.cy),
            rollDeg: lastRoi ? lastRoi.rollDeg : null,
            framesOk: ok,
            framesMissed: missed,
            delegate: tracker.delegate,
            engineKind: engine.kind,
          }));
        }
      };
      setPhase('live');
      s.watchdog = setTimeout(() => engine.post({ type: 'finalize' }), (CAPTURE_SEC + 15) * 1000);
      s.stopLoop = deps.startLoop(video, onFrame);
    } catch (e) {
      if (s.done && session.current !== s) return;
      if (e instanceof CameraError) fail({ kind: e.kind, message: e.message });
      else if (e instanceof TrackerLoadError) fail({ kind: 'tracker', message: e.message });
      else fail({ kind: 'other', message: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  }, [deps, fail, teardown]);

  const stop = useCallback(() => {
    teardown();
    setPhase('idle');
  }, [teardown]);

  useEffect(() => teardown, [teardown]);

  return { phase, live, result, error, videoRef, overlayRef, start, stop };
}
