import type { PersonalResult } from '../domain/types';
import { missionDayLabel } from '../state/missionSelectors';
import { StatusPill } from './StatusPill';
import { Value } from './Value';

export interface BandChartTableProps {
  id: string;
  title: string;
  series: PersonalResult['series'];
  unit?: string;
  precision?: number;
  sourceIds: readonly string[];
}

/** "View data" table alternative for BandChart (doc 11 §8). */
export function BandChartTable({ id, title, series, unit, precision, sourceIds }: BandChartTableProps) {
  return (
    <div id={id} className="max-h-72 overflow-auto rounded-control border border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{title}: values per mission day</caption>
        <thead className="sticky top-0 bg-surface-2 text-xs text-text-2">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Day
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Value
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Band low
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Band high
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Personal
            </th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.missionDay} className="border-t border-border">
              <th scope="row" className="px-3 py-1 font-mono text-xs font-normal text-text-2">
                {missionDayLabel(p.missionDay)}
              </th>
              <td className="px-3 py-1">
                <Value value={p.value} unit={unit} precision={precision} sourceIds={sourceIds} size="sm" />
              </td>
              <td className="px-3 py-1">
                <Value value={p.lo} unit={unit} precision={precision} sourceIds={sourceIds} size="sm" />
              </td>
              <td className="px-3 py-1">
                <Value value={p.hi} unit={unit} precision={precision} sourceIds={sourceIds} size="sm" />
              </td>
              <td className="px-3 py-1">
                <StatusPill verdict={p.state} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
