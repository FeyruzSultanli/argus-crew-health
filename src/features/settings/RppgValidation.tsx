// Camera-pulse (rPPG) validation block of the Limits page (doc 09 §1.5, doc 14 §4). No paired validation exists yet
// (decision register #10: no pulse oximeter), so the honest placeholder from seed/limits.json is shown. A later
// results table is passed in as data — nothing here invents numbers.
import { Value } from '../../ui';

/** One comparison of camera pulse against a reference device. */
export interface RppgValidationRow {
  /** e.g. "Smartwatch (wrist PPG)", seated, room light. */
  condition: string;
  /** Number of paired readings. */
  n: number;
  /** Mean absolute error, beats per minute. */
  maeBpm: number;
  /** Mean difference camera − reference, beats per minute. */
  biasBpm: number;
  /** 95 % limits of agreement, beats per minute. */
  loaLowBpm: number;
  loaHighBpm: number;
  /** Registry ids behind this row (e.g. the validation record's source entry). */
  sourceIds: string[];
}

export interface RppgValidationProps {
  placeholder: string;
  /** Empty or absent = no validation done; the placeholder is shown. */
  rows?: readonly RppgValidationRow[];
}

const BPM = '/min';

export function RppgValidation({ placeholder, rows = [] }: RppgValidationProps) {
  if (rows.length === 0) {
    return (
      <p
        className="rounded-control border border-dashed border-border-strong px-4 py-3 text-sm text-text"
        data-testid="rppg-placeholder"
      >
        {placeholder}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Camera pulse compared with a reference device</caption>
        <thead>
          <tr className="border-b border-border-strong text-xs text-text-2">
            <th scope="col" className="py-2 pr-4 font-medium">
              Condition
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              n
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              MAE
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Bias
            </th>
            <th scope="col" className="py-2 font-medium">
              Limits of agreement
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.condition} className="border-b border-border">
              <th scope="row" className="py-2 pr-4 font-medium text-text">
                {r.condition}
              </th>
              <td className="py-2 pr-4">
                <Value value={r.n} sourceIds={r.sourceIds} size="sm" />
              </td>
              <td className="py-2 pr-4">
                <Value value={r.maeBpm} unit={BPM} precision={1} sourceIds={r.sourceIds} size="sm" />
              </td>
              <td className="py-2 pr-4">
                <Value value={r.biasBpm} unit={BPM} precision={1} sourceIds={r.sourceIds} size="sm" />
              </td>
              <td className="py-2">
                <Value value={r.loaLowBpm} unit={BPM} precision={1} sourceIds={r.sourceIds} size="sm" /> to{' '}
                <Value value={r.loaHighBpm} unit={BPM} precision={1} sourceIds={r.sourceIds} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
