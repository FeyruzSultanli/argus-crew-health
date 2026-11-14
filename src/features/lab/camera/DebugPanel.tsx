// ?debug=rppg readout under the video (doc 09 §1.2): a developer tool for the human landmark check. Its numbers are
// pipeline diagnostics (fps, frame counts, raw luminance…), not health values, so they stay plain monospace text
// for readability instead of <Value> badges.
import { Button } from '../../../ui';
import type { LiveState } from './session';

export function DebugPanel({
  live,
  mirrored,
  onToggleMirror,
}: {
  live: LiveState;
  mirrored: boolean;
  onToggleMirror: () => void;
}) {
  const f = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));
  const rows: Array<[string, string]> = [
    ['fps', f(live.fps, 0)],
    ['SNR (dB)', f(live.estimate?.snrDb)],
    ['luminance', f(live.lum)],
    ['clip %', f(live.clip)],
    ['motion SD (px@640)', f(live.motionPx)],
    ['roll (deg)', f(live.rollDeg)],
    ['frames ok / missed', `${live.framesOk} / ${live.framesMissed}`],
    ['tracker / engine', `${live.delegate} / ${live.engineKind}`],
  ];
  return (
    <div className="mt-3 rounded-card border border-watch-border bg-surface-1 p-3" data-testid="rppg-debug">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm text-watch-fg">debug=rppg · landmarks 10 152 234 454 168 33 263 61 291</p>
        <Button onClick={onToggleMirror} aria-pressed={mirrored}>
          Mirror view: {mirrored ? 'on' : 'off'}
        </Button>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-base sm:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-text-3">{k}</dt>
            <dd className="text-text">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
