// What is real / measured / simulated / modeled / demo / experimental (FR-SET-3), rendered from seed/limits.json.
import { Beaker, Calculator, Database, FlaskConical, Ruler, Shuffle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { DataKind, LimitsContent } from '../handbook/content';
import { Badge, SourceBadge } from '../../ui';

const KIND_ICON: Record<DataKind, LucideIcon> = {
  real: Database,
  measured: Ruler,
  simulated: Shuffle,
  modeled: Calculator,
  demo: Beaker,
  experimental: FlaskConical,
};

const KIND_ORDER: readonly DataKind[] = ['real', 'measured', 'simulated', 'modeled', 'demo', 'experimental'];

const AVAILABILITY: Record<'unavailable' | 'not-built', string> = {
  unavailable: 'Unavailable in this build',
  'not-built': 'Not built',
};

export interface LimitsTableProps {
  content: Pick<LimitsContent, 'dataKinds' | 'kindLabels'>;
}

/** One table, rows grouped by kind (table order = KIND_ORDER, then seed order). Neutral chrome: kind = icon + word. */
export function LimitsTable({ content }: LimitsTableProps) {
  const rows = [...content.dataKinds].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" data-testid="limits-table">
        <caption className="sr-only">
          What in ARGUS is real, measured, simulated, modeled, demo or experimental
        </caption>
        <thead>
          <tr className="border-b border-border-strong text-xs text-text-2">
            <th scope="col" className="py-2 pr-4 font-medium">
              Kind
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              What
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Detail
            </th>
            <th scope="col" className="py-2 font-medium">
              Sources
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const Icon = KIND_ICON[row.kind];
            return (
              <tr key={row.id} className="border-b border-border align-top" data-kind={row.kind}>
                <td className="py-3 pr-4">
                  <Badge icon={Icon} variant="outline">
                    {content.kindLabels[row.kind]}
                  </Badge>
                </td>
                <th scope="row" className="py-3 pr-4 font-medium text-text">
                  {row.label}
                  {row.availability && (
                    <span className="mt-1 block">
                      <Badge variant="outline" mono>
                        {AVAILABILITY[row.availability]}
                      </Badge>
                    </span>
                  )}
                </th>
                <td className="max-w-[56ch] py-3 pr-4 text-text-2">{row.detail}</td>
                <td className="py-3">
                  {row.sourceIds.length > 0 ? (
                    <SourceBadge sourceIds={row.sourceIds} title={row.label} />
                  ) : (
                    <span className="text-xs text-text-3">None</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
