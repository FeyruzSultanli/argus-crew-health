// One eye of the tumbling-E near-acuity test (doc 09 §3.3). The E is drawn on a canvas in DEVICE pixels at the
// height h = d · tan(5 · 10^logMAR / 60 °) for 60 cm; answers come from the arrow keys or four large buttons.
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, EyeOff, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  ACUITY_DISTANCE_MM,
  ACUITY_LINES,
  OPTOTYPES_PER_LINE,
  acuityPosition,
  answerAcuity,
  createAcuityTest,
  currentOrientation,
  drawableLineCount,
  optotypeHeightDevicePx,
  type AcuityState,
  type EDirection,
} from '../../../measurement/vision';
import { Button, Card } from '../../../ui';
import { eyeName, otherEye, type Eye } from './observations';
import { SCRIPTED_ACUITY_LAST_LINE } from './testMode';

const ROTATION: Record<EDirection, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const BUTTONS: Array<{ dir: EDirection; label: string; icon: LucideIcon; key: string }> = [
  { dir: 'up', label: 'Up', icon: ArrowUp, key: 'ArrowUp' },
  { dir: 'left', label: 'Left', icon: ArrowLeft, key: 'ArrowLeft' },
  { dir: 'right', label: 'Right', icon: ArrowRight, key: 'ArrowRight' },
  { dir: 'down', label: 'Down', icon: ArrowDown, key: 'ArrowDown' },
];

/** Draws an E (5 × 5 strokes, legs pointing `dir`) of height hDev device pixels, centred on the canvas. */
function drawE(canvas: HTMLCanvasElement, hDev: number, dir: EDirection, dpr: number) {
  const size = Math.ceil(hDev) + 4;
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size / dpr}px`;
  canvas.style.height = `${size / dpr}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(ROTATION[dir]);
  const u = hDev / 5;
  const o = -hDev / 2;
  ctx.fillStyle = '#000000';
  ctx.fillRect(o, o, u, hDev); // spine
  for (const row of [0, 2, 4]) ctx.fillRect(o, o + row * u, hDev, u); // three legs pointing right before rotation
  ctx.restore();
}

export interface AcuityTestProps {
  eye: Eye;
  pxPerMm: number;
  seed: number;
  scripted: boolean;
  onDone: (state: AcuityState) => void;
}

export function AcuityTest({ eye, pxPerMm, seed, scripted, onDone }: AcuityTestProps) {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const geometry = { distanceMm: ACUITY_DISTANCE_MM, pxPerMm, dpr };
  const [state, setState] = useState(() => createAcuityTest(seed, drawableLineCount(geometry)));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dir = currentOrientation(state);
  const { line, item } = acuityPosition(state);
  const logMAR = ACUITY_LINES[line] ?? 0;
  const hDev = optotypeHeightDevicePx(logMAR, geometry);

  useEffect(() => {
    if (canvasRef.current && dir) drawE(canvasRef.current, hDev, dir, dpr);
  }, [hDev, dir, dpr, line, item]);

  const reported = useRef(false);
  useEffect(() => {
    if (!state.done || reported.current) return;
    reported.current = true;
    onDone(state);
  }, [state, onDone]);

  const answer = (d: EDirection) => setState((s) => answerAcuity(s, d));
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const b = BUTTONS.find((x) => x.key === e.key);
      if (!b) return;
      e.preventDefault();
      setState((s) => answerAcuity(s, b.dir));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const runScript = () => {
    let s = state;
    while (!s.done) {
      const p = acuityPosition(s);
      const truth = currentOrientation(s) as EDirection;
      const wrong = BUTTONS.find((b) => b.dir !== truth)?.dir as EDirection;
      const lm = ACUITY_LINES[p.line] ?? 0;
      s = answerAcuity(s, lm >= SCRIPTED_ACUITY_LAST_LINE - 1e-9 || p.item < 2 ? truth : wrong);
    }
    setState(s);
  };

  return (
    <Card title={`${eyeName(eye)} — near acuity`} headingLevel={2}>
      <p className="mb-3 flex items-start gap-2 text-sm text-text-2">
        <EyeOff aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
        Cover your {otherEye(eye)} eye. Which way do the legs of the E point? Guess if you are not sure.
      </p>
      <p className="mb-2 font-mono text-sm text-text-2" data-testid="acuity-position" data-logmar={logMAR}>
        Line logMAR {logMAR.toFixed(1)} · letter {Math.min(item + 1, OPTOTYPES_PER_LINE)} of {OPTOTYPES_PER_LINE}
      </p>
      <div className="flex min-h-40 items-center justify-center rounded-control bg-white p-6 [color-scheme:light]" data-testid="acuity-stage">
        <canvas ref={canvasRef} role="img" aria-label={`Tumbling E, line logMAR ${logMAR.toFixed(1)}, letter ${item + 1} of ${OPTOTYPES_PER_LINE}`} data-h-device-px={hDev.toFixed(2)} />
      </div>
      <div className="mx-auto mt-4 grid max-w-xs grid-cols-3 gap-2" role="group" aria-label="Direction of the E">
        {BUTTONS.map((b) => (
          <Button
            key={b.dir}
            icon={b.icon}
            onClick={() => answer(b.dir)}
            className={
              b.dir === 'up' ? 'col-start-2 min-h-14' : b.dir === 'left' ? 'col-start-1 row-start-2 min-h-14' : b.dir === 'right' ? 'col-start-3 row-start-2 min-h-14' : 'col-start-2 row-start-3 min-h-14'
            }
          >
            {b.label}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-text-2">Arrow keys work too.</p>
      {scripted && (
        <div className="mt-4">
          <Button icon={Wand2} onClick={runScript} data-testid="vision-script-answers">
            Answer scripted
          </Button>
        </div>
      )}
    </Card>
  );
}
