// Accessible alternatives to the chart picture: the flagged-days list and the "View data" table (doc 11 §8).
import { missionDayLabel } from '../../state/missionSelectors';
import { StatusPill } from '../../ui/StatusPill';
import { Value } from '../../ui/Value';
import type { SignalDef } from '../../domain/types';
import type { TrendTrack, VerdictMarker } from './trendData';
import { pointSourceIds } from './trendData';

const MAX_FLAGS = 8;

/** WATCH / ACT days in view (latest first), icon + word, never colour alone. */
export function FlaggedDays({
  markers,
  unit,
  precision,
  def,
  multi,
}: {
  markers: readonly VerdictMarker[];
  unit: string;
  precision: number;
  def: SignalDef;
  multi: boolean;
}) {
  if (markers.length === 0) return null;
  const shown = [...markers].reverse().slice(0, MAX_FLAGS);
  return (
    <div className="text-xs text-text-2">
      <p className="mb-1 font-medium text-text">Flagged days in view</p>
      <ul aria-label={`${def.label}: flagged days`} className="flex flex-wrap gap-x-4 gap-y-1">
        {shown.map((m) => (
          <li
            key={`${m.trackLabel}-${m.missionDay}`}
            data-testid={`flag-${def.id}-${m.state.toLowerCase()}-${m.missionDay}`}
            className="inline-flex min-h-target items-center gap-1.5"
          >
            <span className="font-mono">{missionDayLabel(m.missionDay)}</span>
            {multi && <span>{m.trackLabel}</span>}
            <StatusPill verdict={m.state} size="sm" />
            <Value
              value={m.value}
              unit={unit}
              precision={precision}
              sourceIds={pointSourceIds(def, m)}
              size="sm"
              title={def.label}
            />
          </li>
        ))}
        {markers.length > MAX_FLAGS && <li>and {markers.length - MAX_FLAGS} earlier (see View data)</li>}
      </ul>
    </div>
  );
}

export interface TrendTableProps {
  id: string;
  def: SignalDef;
  title: string;
  tracks: readonly TrendTrack[];
  unit: string;
  precision: number;
  bandSourceIds: readonly string[];
}

/** Day, value, band low/high, personal verdict and data label per plotted point. */
export function TrendTable({ id, def, title, tracks, unit, precision, bandSourceIds }: TrendTableProps) {
  const multi = tracks.length > 1;
  const anyBand = tracks.some((t) => t.band);
  const rows = tracks.flatMap((t) => t.points.map((p) => ({ t, p }))).sort((a, b) => a.p.x - b.p.x);
  const th = 'px-3 py-2 font-medium';
  return (
    <div
      id={id}
      className="max-h-72 overflow-auto rounded-control border border-border"
      tabIndex={0}
      role="region"
      aria-label={`${title}: data table`}
    >
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{title}: values per mission day</caption>
        <thead className="sticky top-0 bg-surface-2 text-xs text-text-2">
          <tr>
            <th scope="col" className={th}>
              Day
            </th>
            {multi && (
              <th scope="col" className={th}>
                Series
              </th>
            )}
            <th scope="col" className={th}>
              Value
            </th>
            {anyBand && (
              <th scope="col" className={th}>
                Band low
              </th>
            )}
            {anyBand && (
              <th scope="col" className={th}>
                Band high
              </th>
            )}
            {anyBand && (
              <th scope="col" className={th}>
                Personal
              </th>
            )}
            <th scope="col" className={th}>
              Data
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ t, p }) => (
            <tr key={`${t.key}-${p.missionDay}`} className="border-t border-border" data-day={p.missionDay}>
              <th scope="row" className="px-3 py-1 font-mono text-xs font-normal text-text-2">
                {missionDayLabel(p.missionDay)}
              </th>
              {multi && <td className="px-3 py-1 text-xs">{t.label}</td>}
              <td className="px-3 py-1">
                <Value
                  value={p.value}
                  unit={unit}
                  precision={precision}
                  sourceIds={pointSourceIds(def, p)}
                  size="sm"
                />
              </td>
              {anyBand && (
                <td className="px-3 py-1">
                  {p.lo !== undefined ? (
                    <Value
                      value={p.lo}
                      unit={unit}
                      precision={precision}
                      sourceIds={bandSourceIds}
                      size="sm"
                    />
                  ) : (
                    <span className="text-text-3">n/a</span>
                  )}
                </td>
              )}
              {anyBand && (
                <td className="px-3 py-1">
                  {p.hi !== undefined ? (
                    <Value
                      value={p.hi}
                      unit={unit}
                      precision={precision}
                      sourceIds={bandSourceIds}
                      size="sm"
                    />
                  ) : (
                    <span className="text-text-3">n/a</span>
                  )}
                </td>
              )}
              {anyBand && (
                <td className="px-3 py-1">
                  {p.state ? (
                    <StatusPill verdict={p.state} size="sm" />
                  ) : (
                    <span className="text-text-3">Pre-flight</span>
                  )}
                </td>
              )}
              <td className="px-3 py-1 font-mono text-[11px] text-text-2">
                {p.measured ? 'MEASURED' : 'SIMULATED'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
