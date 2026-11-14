// Live capture view (doc 09 §1.4 step 2): video with face guide + ROI tint, distance hint, lighting meter,
// countdown, live waveform and a stabilising bpm (greyed until 10 s). Debug panel with ?debug=rppg.
import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { CAPTURE_SEC } from '../../../measurement/rppg/accumulator';
import { Button, Card, Countdown, Value } from '../../../ui';
import { LightingMeter, Trace } from './bits';
import { PRIVACY_LINE } from './copy';
import { DebugPanel } from './DebugPanel';
import type { LiveState, SessionPhase } from './session';
import { POS_SOURCE } from './sources';

interface LiveViewProps {
  phase: SessionPhase;
  live: LiveState;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  debug: boolean;
  mirrored: boolean;
  onToggleMirror: () => void;
  onCancel: () => void;
}

const DISTANCE_WORD = { closer: 'Move a little closer', back: 'Move back a little', ok: 'Distance OK' } as const;
const CAPTURE_MS = CAPTURE_SEC * 1000;

function announce(remaining: number, phase: SessionPhase): string {
  if (phase === 'starting') return 'Starting the camera.';
  const r = Math.ceil(remaining);
  if (r === CAPTURE_SEC) return 'Measuring. Hold still.';
  return r % 10 === 0 && r > 0 ? `${r} seconds left.` : '';
}

export function LiveView({ phase, live, videoRef, overlayRef, debug, mirrored, onToggleMirror, onCancel }: LiveViewProps) {
  const remaining = CAPTURE_SEC - live.elapsedSec;
  const est = live.estimate;
  const bpm = est?.bpm != null ? Math.round(est.bpm) : null;
  const stable = (est?.stable ?? false) && bpm !== null;
  // The Countdown runs on the capture's own frame clock (data time), not the wall clock.
  const elapsedMs = useRef(0);
  useEffect(() => {
    elapsedMs.current = phase === 'live' ? live.elapsedSec * 1000 : 0;
  }, [live.elapsedSec, phase]);
  const frameClock = useCallback(() => elapsedMs.current, []);
  const hint = !live.faceFound
    ? live.rollDeg !== null && Math.abs(live.rollDeg) > 15
      ? 'Keep your head level'
      : 'Face the camera inside the oval'
    : live.distance
      ? DISTANCE_WORD[live.distance]
      : '';
  const flip = mirrored ? '-scale-x-100' : '';
  return (
    <section aria-labelledby="cp-live" className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)]">
      <h2 id="cp-live" className="sr-only">
        Live measurement
      </h2>
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-border bg-black">
          <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 size-full object-contain ${flip}`} />
          <canvas ref={overlayRef} width={640} height={480} aria-hidden="true" className="absolute inset-0 size-full object-contain" />
          {phase === 'starting' && (
            <p className="absolute inset-0 flex items-center justify-center text-text-2">Starting camera and face tracker…</p>
          )}
          {phase === 'live' && hint && (
            <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-pill bg-bg/80 px-3 py-1 text-sm text-text">{hint}</p>
          )}
        </div>
        <p className="mt-2 text-sm text-text-2">{PRIVACY_LINE}</p>
        {debug && <DebugPanel live={live} mirrored={mirrored} onToggleMirror={onToggleMirror} />}
      </div>
      <Card className="flex flex-col gap-4">
        <Countdown startedAt={0} endsAt={CAPTURE_MS} now={frameClock} label="Capture" size="lg" />
        <div>
          <p className="text-sm text-text-2">Pulse</p>
          <Value
            value={bpm}
            unit="/min"
            sourceIds={POS_SOURCE}
            label="MEASURED"
            size="xl"
            tone={stable ? undefined : 'muted'}
            title="Pulse (camera, live estimate)"
          />
          <p className="text-xs text-text-3">
            {bpm === null ? 'waiting for a pulse' : stable ? 'live estimate' : 'stabilising…'}
          </p>
        </div>
        <p className="sr-only" aria-live="polite" role="status">
          {announce(remaining, phase)}
        </p>
        <div>
          <p className="text-sm text-text-2">Pulse wave</p>
          <Trace values={est?.waveform ?? []} label="Live pulse waveform" />
        </div>
        <LightingMeter lum={live.lum} clip={live.clip} />
        <Button onClick={onCancel}>Cancel measurement</Button>
      </Card>
    </section>
  );
}
