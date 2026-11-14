// Live view of the face scan: video + guide oval (+ ?debug=face landmark overlay), the three acceptance indicators
// in words + icons (never colour alone), the 3-s countdown on the capture's own frame clock, and the acceptance
// limits shown as demo parameters.
import { CircleCheck, CircleX } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { FACE_SCAN } from '../../../measurement/face/fluidShiftIndex';
import { Badge, Button, Card, Countdown, Value } from '../../../ui';
import { PRIVACY_LINE } from './copy';
import type { ScanLive, ScanPhase } from './useFaceScan';

const DEMO = [FACE_SCAN.sourceId];

function Indicator({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon aria-hidden="true" size={20} className={ok ? 'text-ok' : 'text-watch'} />
      <span className="font-semibold text-text">{ok ? yes : no}</span>
    </li>
  );
}

function DebugPanel({ live }: { live: ScanLive }) {
  const n = (v: number | null, p: number) => (v === null ? '—' : v.toFixed(p));
  return (
    <div data-testid="face-debug" className="mt-3 rounded-card border border-border bg-surface-2 p-3 font-mono text-xs text-text-2">
      <p>debug=face · {live.delegate} · frames {live.accepted}/{live.total} accepted</p>
      <p>
        yaw {n(live.yawDeg, 1)}° · pitch {n(live.pitchDeg, 1)}° · jawOpen {n(live.jawOpen, 2)} · smile {n(live.smile, 2)}
      </p>
      <p>Landmarks: 468/473 iris · 234/454 cheek · 172/397 jaw · 159/145 + 386/374 lids</p>
    </div>
  );
}

export function FaceLiveView({
  phase,
  live,
  videoRef,
  overlayRef,
  debug,
  mirrored,
  onCancel,
}: {
  phase: ScanPhase;
  live: ScanLive;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  debug: boolean;
  mirrored: boolean;
  onCancel: () => void;
}) {
  const elapsedMs = useRef(0);
  useEffect(() => {
    elapsedMs.current = phase === 'live' ? live.elapsedSec * 1000 : 0;
  }, [live.elapsedSec, phase]);
  const frameClock = useCallback(() => elapsedMs.current, []);
  const flip = mirrored ? '-scale-x-100' : '';
  return (
    <section aria-labelledby="fs-live" className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)]">
      <h2 id="fs-live" className="sr-only">
        Live scan
      </h2>
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-border bg-black">
          <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 size-full object-contain ${flip}`} />
          <canvas ref={overlayRef} width={640} height={480} aria-hidden="true" className="absolute inset-0 size-full object-contain" />
          {phase === 'starting' && (
            <p className="absolute inset-0 flex items-center justify-center text-text-2">Starting camera and face tracker…</p>
          )}
        </div>
        <p className="mt-2 text-sm text-text-2">{PRIVACY_LINE}</p>
        {debug && <DebugPanel live={live} />}
      </div>
      <Card className="flex flex-col gap-4">
        <Countdown startedAt={0} endsAt={FACE_SCAN.captureSec * 1000} now={frameClock} label="Scan" size="lg" />
        <ul className="flex flex-col gap-2" aria-label="Scan checks" data-testid="face-indicators">
          <Indicator ok={live.faceFound} yes="Face found" no="No face found" />
          <Indicator ok={live.faceFound && live.poseOk} yes="Head straight" no="Head turned — face the camera" />
          <Indicator ok={live.faceFound && live.expressionOk} yes="Neutral face" no="Mouth open or smiling" />
        </ul>
        <p className="sr-only" role="status" aria-live="polite">
          {phase === 'starting' ? 'Starting the camera.' : 'Scanning. Hold still.'}
        </p>
        <div className="flex flex-wrap items-center gap-1 text-xs text-text-3">
          <span>A frame counts when the head is turned less than</span>
          <Value value={FACE_SCAN.maxYawDeg} unit="°" sourceIds={DEMO} size="sm" title="Maximum head yaw / pitch" />
          <span>and jaw-open is below</span>
          <Value value={FACE_SCAN.maxJawOpen} precision={2} sourceIds={DEMO} size="sm" title="Maximum jawOpen blendshape" />
          <span>and smile below</span>
          <Value value={FACE_SCAN.maxSmile} precision={2} sourceIds={DEMO} size="sm" title="Maximum smile blendshape" />
          <Badge tone="neutral" variant="outline" mono>
            Demo parameter
          </Badge>
        </div>
        <Button onClick={onCancel}>Cancel scan</Button>
      </Card>
    </section>
  );
}
