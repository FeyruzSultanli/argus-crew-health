// Capture session of the face scan: camera → MediaPipe (landmarks + blendshapes + transformation matrix) → per-frame
// numbers (three normalised features, yaw/pitch, jawOpen/smile) → median over the accepted frames of a 3-s window.
// PRIVACY (docs/PROJECT_RULES.md rule 7): the video element is handed to the tracker in memory; no frame is drawn to a canvas,
// encoded, stored or sent. Only the numbers of each frame are kept. All tracks stop on finish, stop() and unmount.
import { useCallback, useEffect, useRef, useState } from 'react';

import { FACE_SCAN, type FaceFrame, type ScanSummary, judgeFrame, summarizeScan } from '../../../measurement/face/fluidShiftIndex';
import { faceGeometry } from '../../../measurement/face/geometry';
import { expressionFromBlendshapes, poseFromMatrix } from '../../../measurement/face/pose';
import { CameraError, stopStream } from '../../../measurement/rppg/capture';
import type { NormLandmark } from '../../../measurement/rppg/roi';
import { type FaceScanDeps, FaceTrackerLoadError } from './deps';
import { drawFaceOverlay } from './overlay';

export type ScanPhase = 'idle' | 'starting' | 'live' | 'done' | 'error';
export interface ScanError {
  kind: string;
  message: string;
}
export interface ScanLive {
  elapsedSec: number;
  faceFound: boolean;
  poseOk: boolean;
  expressionOk: boolean;
  yawDeg: number | null;
  pitchDeg: number | null;
  jawOpen: number | null;
  smile: number | null;
  accepted: number;
  total: number;
  delegate: string;
}
export const EMPTY_SCAN_LIVE: ScanLive = {
  elapsedSec: 0,
  faceFound: false,
  poseOk: false,
  expressionOk: false,
  yawDeg: null,
  pitchDeg: null,
  jawOpen: null,
  smile: null,
  accepted: 0,
  total: 0,
  delegate: '—',
};

interface Session {
  stream: MediaStream | null;
  stopLoop: (() => void) | null;
  watchdog: ReturnType<typeof setTimeout> | null;
  done: boolean;
}

/** Fallback image size when the video reports none (tests, very early frames). */
const FALLBACK_W = 640;
const FALLBACK_H = 480;

function waitFor<T>(get: () => T | null, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const v = get();
      if (v) resolve(v);
      else if (Date.now() - t0 > timeoutMs) reject(new Error('video element not mounted'));
      else setTimeout(tick, 16);
    };
    tick();
  });
}

export function useFaceScan(deps: FaceScanDeps, opts: { debug: boolean; mirrored: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const session = useRef<Session | null>(null);
  const optsRef = useRef(opts);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [live, setLive] = useState<ScanLive>(EMPTY_SCAN_LIVE);
  const [result, setResult] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<ScanError | null>(null);

  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const teardown = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.done = true;
    s.stopLoop?.();
    if (s.watchdog) clearTimeout(s.watchdog);
    stopStream(s.stream);
    const video = videoRef.current;
    if (video) video.srcObject = null;
    session.current = null;
  }, []);

  const fail = useCallback(
    (err: ScanError) => {
      teardown();
      setError(err);
      setPhase('error');
    },
    [teardown],
  );

  const start = useCallback(async () => {
    teardown();
    const s: Session = { stream: null, stopLoop: null, watchdog: null, done: false };
    session.current = s;
    setError(null);
    setResult(null);
    setLive(EMPTY_SCAN_LIVE);
    setPhase('starting');
    try {
      const [stream, tracker] = await Promise.all([
        deps.openCamera().then((st) => {
          s.stream = st;
          if (s.done) stopStream(st);
          return st;
        }),
        deps.loadTracker(),
      ]);
      if (s.done) return;
      const video = await waitFor(() => videoRef.current);
      video.srcObject = stream;
      video.muted = true;
      try {
        await video.play();
      } catch {
        // muted inline autoplay is allowed; a rejection here is not fatal
      }
      if (s.done) return;
      const frames: FaceFrame[] = [];
      let t0: number | null = null;
      let lastTs = 0;
      let lastUi = -Infinity;
      let accepted = 0;
      const finish = () => {
        if (s.done) return;
        teardown();
        setResult(summarizeScan(frames));
        setPhase('done');
      };
      const onFrame = (now: number) => {
        if (s.done) return;
        const ts = Math.max(now, lastTs + 1);
        lastTs = ts;
        if (t0 === null) t0 = ts;
        let frame: FaceFrame;
        let landmarks: NormLandmark[] | null;
        try {
          const det = tracker.detect(video, ts);
          landmarks = det?.landmarks ?? null;
          frame = det
            ? {
                features: faceGeometry(det.landmarks, video.videoWidth || FALLBACK_W, video.videoHeight || FALLBACK_H)?.features ?? null,
                pose: poseFromMatrix(det.matrix),
                expression: expressionFromBlendshapes(det.blendshapes),
              }
            : { features: null, pose: null, expression: null };
        } catch (e) {
          fail({ kind: 'processing', message: e instanceof Error ? e.message : 'Frame processing failed.' });
          return;
        }
        frames.push(frame);
        const verdict = judgeFrame(frame);
        if (verdict.accepted) accepted++;
        const canvas = overlayRef.current;
        if (canvas) drawFaceOverlay(canvas, landmarks, { ...optsRef.current, accepted: verdict.accepted });
        const elapsedSec = (ts - t0) / 1000;
        if (elapsedSec >= FACE_SCAN.captureSec) {
          finish();
          return;
        }
        if (ts - lastUi >= 150) {
          lastUi = ts;
          setLive({
            elapsedSec,
            faceFound: frame.features !== null,
            poseOk: verdict.poseOk,
            expressionOk: verdict.expressionOk,
            yawDeg: frame.pose?.yawDeg ?? null,
            pitchDeg: frame.pose?.pitchDeg ?? null,
            jawOpen: frame.expression?.jawOpen ?? null,
            smile: frame.expression?.smile ?? null,
            accepted,
            total: frames.length,
            delegate: tracker.delegate,
          });
        }
      };
      setPhase('live');
      // If the camera delivers no frames at all, end with what was captured (an honest "poor" result).
      s.watchdog = setTimeout(finish, (FACE_SCAN.captureSec + 12) * 1000);
      s.stopLoop = deps.startLoop(video, onFrame);
    } catch (e) {
      if (s.done && session.current !== s) return;
      if (e instanceof CameraError) fail({ kind: e.kind, message: e.message });
      else if (e instanceof FaceTrackerLoadError) fail({ kind: 'tracker', message: e.message });
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
