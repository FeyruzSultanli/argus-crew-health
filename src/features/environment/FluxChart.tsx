// GOES ≥10 MeV and ≥100 MeV integral proton flux, log scale, S1–S5 dashed threshold lines, 6 h / 1 d / 3 d / 7 d
// tabs (doc 11 §5.5 row 1). Custom-styled Recharts; "View data" table as the accessible alternative.
import { useId, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2 } from 'lucide-react';

import { S_SCALE_SOURCE_IDS, S_THRESHOLDS_PFU } from '../../domain/radiation/sscale';
import type { SpaceWeatherView } from '../../services/spaceWeather';
import { Button, Card, SegmentedControl, Value } from '../../ui';
import { dataLabelOf, formatUtcShort } from './format';
import { fluxRows, logFloor, RANGE_MS, type FluxRange } from './fluxData';
import { ReplayTag } from './ReplayTag';

const AXIS_TICK = { fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' };
const RANGES: ReadonlyArray<{ value: FluxRange; label: string }> = [
  { value: '6h', label: '6 h' },
  { value: '1d', label: '1 d' },
  { value: '3d', label: '3 d' },
  { value: '7d', label: '7 d' },
];
const DECADES = [0.01, 0.1, 1, 10, 100, 1_000, 10_000, 100_000];
const fmtPfu = (v: number) => (v >= 1 ? v.toLocaleString('en-US') : String(v));

export function FluxChart({ view }: { view: SpaceWeatherView }) {
  const [range, setRange] = useState<FluxRange>('1d');
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const { state, replay } = view;
  const latest = view.latestTag ? Date.parse(view.latestTag) : 0;
  const [from, to] = replay ? [replay.startMs, replay.endMs] : [latest - RANGE_MS[range], latest];
  const rows = useMemo(
    () => fluxRows(state.protons10, state.protons100, from, to),
    [state.protons10, state.protons100, from, to],
  );
  const floor = logFloor(rows);
  const ticks = DECADES.filter((d) => d >= floor);
  const srcIds = replay ? [...S_SCALE_SOURCE_IDS, ...replay.sourceIds] : [...S_SCALE_SOURCE_IDS];
  const label = dataLabelOf(state.mode);
  const title = replay ? 'Proton flux — replay window' : 'GOES integral proton flux';

  return (
    <Card
      title={title}
      subtitle="≥10 MeV and ≥100 MeV, 5-min samples, log scale (pfu) · dashed lines: S1–S5 (≥10 MeV)"
      actions={
        replay ? (
          <ReplayTag synthetic={replay.synthetic} />
        ) : (
          <SegmentedControl options={RANGES} value={range} onChange={setRange} label="Flux chart range" />
        )
      }
      data-testid="flux-chart"
    >
      <figure className="flex flex-col gap-3" aria-label={`${title}, log scale`}>
        <div aria-hidden="true" className="w-full" style={{ height: 240 }}>
          <LineChart
            responsive
            accessibilityLayer={false}
            data={rows}
            margin={{ top: 8, right: 28, bottom: 0, left: 4 }}
            style={{ width: '100%', height: 240 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[from, to]}
              tickFormatter={(t: number) => formatUtcShort(t)}
              tick={AXIS_TICK}
              stroke="var(--border-strong)"
              tickLine={false}
              minTickGap={48}
            />
            <YAxis
              scale="log"
              domain={[floor, 100_000]}
              allowDataOverflow
              ticks={ticks}
              tickFormatter={fmtPfu}
              tick={AXIS_TICK}
              stroke="var(--border-strong)"
              tickLine={false}
              width={52}
            />
            {S_THRESHOLDS_PFU.map((t, i) => (
              <ReferenceLine
                key={t}
                y={t}
                stroke={i >= 2 ? 'var(--act)' : 'var(--watch)'}
                strokeOpacity={0.7}
                strokeDasharray="4 4"
                label={{ value: `S${i + 1}`, position: 'right', fill: 'var(--text-2)', fontSize: 11 }}
              />
            ))}
            <Line
              dataKey="f10"
              name="≥10 MeV"
              stroke="var(--brand)"
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              dataKey="f100"
              name="≥100 MeV"
              stroke="var(--text-2)"
              strokeWidth={1.25}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)' }}
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
              labelFormatter={(t) => `${formatUtcShort(Number(t))} UTC`}
              formatter={(v, name) => [`${Number(v).toPrecision(3)} pfu`, name]}
            />
          </LineChart>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-2">
          <span className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-0.5 w-5 bg-brand" />
              ≥10 MeV
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-0.5 w-5 bg-text-2" />
              ≥100 MeV
            </span>
            <span>Times in UTC</span>
          </span>
          <Button
            variant="ghost"
            icon={Table2}
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? 'Hide data' : 'View data'}
          </Button>
        </figcaption>
      </figure>
      {showTable && (
        <div
          id={tableId}
          className="mt-3 max-h-72 overflow-auto rounded-control border border-border"
          tabIndex={0}
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {title}: flux per sample, newest first (peak per bucket when thinned)
            </caption>
            <thead className="sticky top-0 bg-surface-2 text-xs text-text-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Time (UTC)
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  ≥10 MeV
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  ≥100 MeV
                </th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice(-96)
                .reverse()
                .map((r) => (
                  <tr key={r.t} className="border-t border-border">
                    <th scope="row" className="px-3 py-1 font-mono text-xs font-normal text-text-2">
                      {formatUtcShort(r.t)}
                    </th>
                    <td className="px-3 py-1">
                      <Value
                        value={r.f10}
                        unit="pfu"
                        precision={2}
                        sourceIds={srcIds}
                        label={label}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <Value
                        value={r.f100}
                        unit="pfu"
                        precision={2}
                        sourceIds={srcIds}
                        label={label}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
