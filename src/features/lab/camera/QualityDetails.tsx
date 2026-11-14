// "How quality is judged": every check with its measured value, rating and thresholds (doc 09 §1.3).
// All numbers render through <Value>; thresholds and quality numbers cite SRC_DEMO_QUALITY_SCORES (demo parameter).
import type { QualityCheck, RppgEstimate } from '../../../measurement/rppg/types';
import { Value } from '../../../ui';
import { DemoParameterBadge, Trace } from './bits';
import { CHECK_NAMES } from './copy';
import { DEMO_QUALITY } from './sources';
import { type Cell, THRESHOLD_ROWS } from './thresholds';

function CellView({ cell }: { cell: Cell }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {cell.map((part, i) =>
        typeof part === 'string' ? (
          <span key={i} className="text-text-3">
            {part}
          </span>
        ) : (
          <Value key={i} value={part.value} unit={part.unit} prefix={part.prefix} sourceIds={DEMO_QUALITY} size="sm" />
        ),
      )}
    </span>
  );
}

const fin = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : null);

function Measured({ c }: { c: QualityCheck }) {
  const v = (value: number | null, unit?: string, precision = 1) => (
    <Value value={value} unit={unit} precision={value === null ? undefined : precision} sourceIds={DEMO_QUALITY} size="sm" label="MEASURED" />
  );
  switch (c.id) {
    case 'snr':
      return v(fin(c.value), 'dB');
    case 'consistency':
      return v(fin(c.value), '/min');
    case 'motion':
      return v(fin(c.value), 'px');
    case 'lighting':
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          {v(fin(c.value), undefined, 0)}
          <span className="text-text-3">·</span>
          {v(fin(c.value2), '%')}
          <span className="text-text-3">clipped</span>
        </span>
      );
    default:
      return v(fin(c.value), '%', 0);
  }
}

export function QualityDetails({ result }: { result: RppgEstimate }) {
  return (
    <details className="mt-6 rounded-control border border-border bg-surface-2 p-3">
      <summary className="flex min-h-target cursor-pointer items-center text-sm font-medium">How quality is judged</summary>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-3">
        All thresholds are our own choices <DemoParameterBadge /> <span className="font-mono">SRC_DEMO_QUALITY_SCORES</span>
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-text-3">
            <tr>
              <th className="py-1 pr-2 font-normal">Check</th>
              <th className="py-1 pr-2 font-normal">Measured</th>
              <th className="py-1 pr-2 font-normal">Rating</th>
              <th className="py-1 pr-2 font-normal">Good</th>
              <th className="py-1 pr-2 font-normal">Fair</th>
              <th className="py-1 font-normal">Poor</th>
            </tr>
          </thead>
          <tbody>
            {result.checks.map((c) => {
              const row = THRESHOLD_ROWS[c.id];
              return (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="py-1 pr-2">{CHECK_NAMES[c.id]}</td>
                  <td className="py-1 pr-2">
                    <Measured c={c} />
                  </td>
                  <td className="py-1 pr-2">{c.label}</td>
                  <td className="py-1 pr-2">
                    <CellView cell={row.good} />
                  </td>
                  <td className="py-1 pr-2">
                    <CellView cell={row.fair} />
                  </td>
                  <td className="py-1">
                    <CellView cell={row.poor} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-2">Pulse spectrum across the heart-rate band</p>
      <Trace values={result.spectrum.power} label="Pulse spectrum" zeroBased />
      <p className="mt-2 text-xs text-text-3">
        Method: Plane-Orthogonal-to-Skin rPPG <span className="font-mono">[SRC_POS_WANG2017]</span>; face regions from
        MediaPipe Face Landmarker <span className="font-mono">[SRC_MEDIAPIPE_FACE]</span>.
      </p>
    </details>
  );
}
