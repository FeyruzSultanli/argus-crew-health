// Cabin CO₂ (doc 10 §9, doc 07 §4.18, doc 11 §5.5 row 3): 1-h gauge, 7-day chart with the 3 mmHg (NASA-STD-3001)
// and 2.5 mmHg (headache-risk) lines, Earth comparison line, 24-h trace. All cabin data is SIMULATED.
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';

import { CO2_LINES } from '../../domain/environment/cabin';
import type { Assessment, EnvironmentSnapshot } from '../../domain/types';
import { missionDayLabel } from '../../state/missionSelectors';
import { Card, Gauge, Sparkline, StatusPill, VERDICT, Value } from '../../ui';

const AXIS_TICK = { fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' };
const LINE_STYLE: Record<string, { stroke: string; dash: string }> = {
  std3001: { stroke: 'var(--watch)', dash: '4 4' },
  headache: { stroke: 'var(--watch)', dash: '1 4' },
  earth: { stroke: 'var(--text-3)', dash: '6 3' },
  act: { stroke: 'var(--act)', dash: '4 4' },
};

export function Co2Card({ env, co2 }: { env: EnvironmentSnapshot; co2: Assessment | undefined }) {
  const week = env.co2.dailyMeans.slice(-7);
  const max = Math.max(4.2, ...week.map((d) => d.mmHg + 0.3));
  const shown = CO2_LINES.filter((l) => l.mmHg <= max);
  const verdict = co2?.verdict ?? 'NO_DATA';
  const has = Number.isFinite(env.co2.last1hMmHg);
  return (
    <Card title="Cabin CO₂" subtitle="ppCO₂ · simulated cabin sensor" data-testid="co2-card">
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2">
          <Gauge
            value={has ? env.co2.last1hMmHg : null}
            max={7}
            size={168}
            label="CO₂ 1-h average"
            unit="mm[Hg]"
            precision={1}
            sourceIds={['SRC_DEMO_SIMULATION', 'SRC_STD3001_CO2']}
            tone={VERDICT[verdict].tone === 'muted' ? undefined : VERDICT[verdict].tone}
            footer={<StatusPill verdict={verdict} size="sm" />}
          />
          <span className="rounded-[4px] border border-dashed border-border-strong px-1 font-mono text-[10px] tracking-wider text-text-2">
            SIMULATED
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {co2 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-2" data-testid="co2-layers">
              <span>Space rules</span>
              <StatusPill verdict={co2.layers.space.verdict} size="sm" />
              <span>Earth rules</span>
              <StatusPill verdict={co2.layers.earth.verdict} size="sm" />
            </div>
          )}
          {co2 && <p className="text-sm text-text-2">{co2.layers.space.reason}</p>}
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-text-2">
            <span>7-day average</span>
            <Value
              value={Number.isFinite(env.co2.avg7dMmHg) ? env.co2.avg7dMmHg : null}
              unit="mm[Hg]"
              precision={2}
              sourceIds={['SRC_DEMO_SIMULATION', 'SRC_NASA_CO2_PAGE']}
              label="SIMULATED"
              size="sm"
              title="Cabin CO₂ 7-day average"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-text-2">
            <span>Last 24 h (5-min, simulated trace)</span>
            <Sparkline
              points={env.co2.series24h.map((p, i) => ({ missionDay: i, value: p.mmHg }))}
              ariaLabel="Cabin CO₂ over the last 24 hours, simulated 5-minute trace"
              width={140}
            />
          </div>
        </div>
      </div>
      <figure className="mt-4 flex flex-col gap-2" aria-label="Cabin CO₂ daily values, last 7 days">
        <div aria-hidden="true" style={{ height: 160 }}>
          <LineChart
            responsive
            accessibilityLayer={false}
            data={week}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            style={{ width: '100%', height: 160 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="missionDay"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(d: number) => missionDayLabel(d)}
              tick={AXIS_TICK}
              stroke="var(--border-strong)"
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              domain={[0, Math.ceil(max)]}
              tick={AXIS_TICK}
              stroke="var(--border-strong)"
              tickLine={false}
              width={32}
            />
            {shown.map((l) => (
              <ReferenceLine
                key={l.id}
                y={l.mmHg}
                stroke={LINE_STYLE[l.id]?.stroke}
                strokeDasharray={LINE_STYLE[l.id]?.dash}
              />
            ))}
            <Line
              dataKey="mmHg"
              stroke="var(--text-2)"
              strokeWidth={1.75}
              dot={{ r: 3, fill: 'var(--text-2)', stroke: 'var(--surface-1)' }}
              isAnimationActive={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
              labelFormatter={(d) => missionDayLabel(Number(d))}
              formatter={(v) => [`${Number(v).toFixed(1)} mmHg`, '1-h average (simulated)']}
            />
          </LineChart>
        </div>
        <figcaption>
          <ul className="flex flex-col gap-1 text-xs text-text-2">
            {CO2_LINES.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <svg width="20" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="20"
                    y2="3"
                    stroke={LINE_STYLE[l.id]?.stroke}
                    strokeWidth="2"
                    strokeDasharray={LINE_STYLE[l.id]?.dash}
                  />
                </svg>
                <span>{l.label}</span>
                <Value value={l.mmHg} unit="mm[Hg]" precision={1} sourceIds={l.sourceIds} size="sm" />
              </li>
            ))}
          </ul>
        </figcaption>
      </figure>
    </Card>
  );
}
