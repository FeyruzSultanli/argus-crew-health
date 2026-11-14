// Optional live viewing-distance estimate from the camera (doc 09 §3.1): iris centres (landmarks 468/473) of the
// shared MediaPipe Face Landmarker → pupil distance in px → pinhole distance with the camera field of view from the
// Settings calibration (default 65°, demo parameter) and an assumed IPD of 63 mm [SRC_IPD_DODGSON].
// PRIVACY (docs/PROJECT_RULES.md rule 7): frames go from the <video> element straight to the landmarker in memory; nothing is
// drawn, encoded, stored or sent. Only the distance is shown, and it is not saved.
import { Camera, CircleCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getFaceLandmarker } from '../../../measurement/face';
import { CameraError, openCamera, startFrameLoop, stopStream } from '../../../measurement/rppg/capture';
import {
  ASSUMED_IPD_MM,
  DISTANCE_TOLERANCE,
  HINT_TEXT,
  IPD_SOURCE_IDS,
  IRIS_LANDMARKS,
  VISION_DEMO_SOURCE_IDS,
  distanceFromIpdMm,
  distanceHint,
  focalLengthPx,
  ipdPixels,
} from '../../../measurement/vision';
import { loadCalibration } from '../../settings/calibration';
import { Button, ErrorState, Value } from '../../../ui';

export const PRIVACY_LINE = 'Video stays on this device. Only the number is saved.';
const WINDOW = 15;

type State = { k: 'idle' } | { k: 'starting' } | { k: 'live' } | { k: 'error'; message: string };

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

export function CameraDistance({ targetMm, onReady }: { targetMm: number; onReady: () => void }) {
  const [state, setState] = useState<State>({ k: 'idle' });
  const [distanceMm, setDistanceMm] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  const start = async () => {
    setState({ k: 'starting' });
    let stream: MediaStream | null = null;
    try {
      stream = await openCamera();
      const video = videoRef.current;
      if (!video) throw new Error('video element missing');
      video.srcObject = stream;
      await video.play();
      const { landmarker } = await getFaceLandmarker();
      const hfov = loadCalibration().cameraFovDeg;
      const recent: number[] = [];
      let last = 0;
      const stopLoop = startFrameLoop(video, (now) => {
        const ts = Math.max(now, last + 1);
        last = ts;
        const lm = landmarker.detectForVideo(video, ts).faceLandmarks[0];
        const a = lm?.[IRIS_LANDMARKS.a];
        const b = lm?.[IRIS_LANDMARKS.b];
        if (!a || !b || !video.videoWidth) return;
        const d = distanceFromIpdMm(ipdPixels(a, b, video.videoWidth, video.videoHeight), focalLengthPx(video.videoWidth, hfov));
        if (d === null) return;
        recent.push(d);
        if (recent.length > WINDOW) recent.shift();
        setDistanceMm(median(recent));
      });
      const s = stream;
      cleanup.current = () => {
        stopLoop();
        stopStream(s);
        video.srcObject = null;
      };
      setState({ k: 'live' });
    } catch (e) {
      stopStream(stream);
      const message = e instanceof CameraError ? e.message : 'The camera or the face model could not start.';
      setState({ k: 'error', message: `${message} Measure the distance with a ruler instead.` });
    }
  };
  const accept = () => {
    cleanup.current();
    onReady();
  };

  const hint = distanceMm === null ? null : distanceHint(distanceMm, targetMm);
  return (
    <div className="flex flex-col gap-3 rounded-control border border-border p-3" data-testid="camera-distance">
      <p className="text-sm text-text-2">
        Optional: the camera can estimate how far you sit (assumed eye spacing{' '}
        <Value value={ASSUMED_IPD_MM} unit="mm" sourceIds={IPD_SOURCE_IDS} size="sm" title="Assumed inter-pupillary distance" />, camera field of view from
        Settings). It guides you to within{' '}
        <Value value={DISTANCE_TOLERANCE * 100} prefix="±" unit="%" precision={0} sourceIds={VISION_DEMO_SOURCE_IDS} size="sm" title="Distance tolerance" /> of
        the target. {PRIVACY_LINE}
      </p>
      <video ref={videoRef} muted playsInline aria-hidden="true" className={state.k === 'live' ? 'h-24 w-32 -scale-x-100 rounded-control bg-black object-cover' : 'hidden'} />
      {state.k === 'idle' && (
        <div>
          <Button icon={Camera} onClick={() => void start()}>
            Check the distance with the camera
          </Button>
        </div>
      )}
      {state.k === 'starting' && <p className="text-sm text-text-2">Starting the camera…</p>}
      {state.k === 'live' && (
        <div aria-live="polite" className="flex flex-wrap items-center gap-4">
          {distanceMm === null ? (
            <p className="text-sm text-text-2">Looking for your eyes…</p>
          ) : (
            <>
              <Value value={distanceMm / 10} unit="cm" precision={0} size="lg" sourceIds={[...IPD_SOURCE_IDS, ...VISION_DEMO_SOURCE_IDS]} label="MEASURED" title="Estimated viewing distance" />
              <p className="font-semibold text-text" data-testid="distance-hint">
                {hint ? HINT_TEXT[hint] : ''}
              </p>
            </>
          )}
          <Button variant="primary" icon={CircleCheck} disabled={hint !== 'ok'} onClick={accept}>
            Distance is right — continue
          </Button>
        </div>
      )}
      {state.k === 'error' && <ErrorState title="Camera not available" message={state.message} />}
    </div>
  );
}
