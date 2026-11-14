// Cabin temperature × humidity comfort plot (doc 10 §9, doc 07 §4.19): performance zone 20–25 °C / 30–60 % RH and
// health limits 18–27 °C [SRC_STD3001_ECLSS]. Last 7 days of simulated cabin readings; today highlighted.
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { COMFORT } from '../../domain/environment/cabin';
import type { Assessment, EnvironmentSnapshot } from '../../domain/types';
import { useObservations } from '../../services/hooks';
import { missionDayLabel } from '../../state/missionSelectors';
import { Card, StatusPill, Value } from '../../ui';

const AXIS_TICK = { fill: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' };
const SIM = ['SRC_DEMO_SIMULATION'];

export interface ComfortPlotProps {
  env: EnvironmentSnapshot;
  temp: Assessment | undefined;
  humidity: Assessment | undefined;
}

export function ComfortPlot({ env, temp, humidity }: ComfortPlotProps) {
  const day = env.missionDay;
  const t = useObservations({ crewId: 'cabin', signalId: 'cabin_temp', fromDay: day - 6, toDay: day });
  const h = useObservations({ crewId: 'cabin', signalId: 'cabin_humidity', fromDay: day - 6, toDay: day });
  const rhByDay = new Map((h ?? []).map((o) => [o.missionDay, o.value]));
  const points = (t ?? [])
    .map((o) => ({ missionDay: o.missionDay, temp: o.value, rh: rhByDay.get(o.missionDay) ?? null }))
    .filter((p): p is { missionDay: number; temp: number; rh: number } => p.temp !== null && p.rh !== null);
  const today = points.filter((p) => p.missionDay === day);
  const earlier = points.filter((p) => p.missionDay !== day);
  const p = COMFORT.performance;
  return (
    <Card
      title="Cabin temperature & humidity"
      subtitle="Comfort zone · simulated cabin sensor"
      data-testid="comfort-plot"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-text-2">Temperature</span>
          <Value
            value={Number.isFinite(env.tempC) ? env.tempC : null}
            unit="Cel"
            precision={1}
            sourceIds={[...SIM, ...COMFORT.sourceIds]}
            label="SIMULATED"
            title="Cabin temperature"
          />
          {temp && <StatusPill verdict={temp.verdict} size="sm" />}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-text-2">Humidity</span>
          <Value
            value={Number.isFinite(env.humidityPct) ? env.humidityPct : null}
            unit="%"
            precision={0}
            sourceIds={[...SIM, ...COMFORT.sourceIds]}
            label="SIMULATED"
            title="Cabin relative humidity"
          />
          {humidity && <StatusPill verdict={humidity.verdict} size="sm" />}
        </span>
      </div>
      <figure
        className="mt-3 flex flex-col gap-2"
        aria-label="Cabin temperature against humidity, last 7 days, with the comfort zone"
      >
        <div aria-hidden="true" style={{ height: 200 }}>
          <ScatterChart
            responsive
            accessibilityLayer={false}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
            style={{ width: '100%', height: 200 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="temp"
              name="Temperature"
              domain={[16, 29]}
              ticks={[16, 18, 20, 22, 25, 27, 29]}
              unit=" °C"
              tick={AXIS_TICK}
              stroke="var(--border-strong)"
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="rh"
              name="Humidity"
              domain={[20, 80]}
              ticks={[20, 30, 45, 60, 80]}
              unit="%"
              tick={AXIS_TICK}
              stroke="var(--border-strong)"
              tickLine={false}
              width={44}
            />
            <ReferenceArea
              x1={p.tempLo}
              x2={p.tempHi}
              y1={p.rhLo}
              y2={p.rhHi}
              fill="var(--ok)"
              fillOpacity={0.1}
              stroke="var(--ok)"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
            />
            <ReferenceLine x={COMFORT.healthTemp.lo} stroke="var(--act)" strokeDasharray="4 4" />
            <ReferenceLine x={COMFORT.healthTemp.hi} stroke="var(--act)" strokeDasharray="4 4" />
            <Scatter data={earlier} fill="var(--text-3)" isAnimationActive={false} />
            <Scatter
              data={today}
              fill="var(--text)"
              stroke="var(--surface-1)"
              isAnimationActive={false}
              shape="diamond"
            />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            />
          </ScatterChart>
        </div>
        <figcaption className="flex flex-col gap-1 text-xs text-text-2">
          <span className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-4 rounded-[2px] border border-dashed border-ok bg-ok-bg"
            />
            Performance zone
            <Value value={p.tempLo} unit="Cel" sourceIds={COMFORT.sourceIds} size="sm" />–
            <Value value={p.tempHi} unit="Cel" sourceIds={COMFORT.sourceIds} size="sm" /> and
            <Value value={p.rhLo} unit="%" sourceIds={COMFORT.sourceIds} size="sm" />–
            <Value value={p.rhHi} unit="%" sourceIds={COMFORT.sourceIds} size="sm" />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <svg width="20" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="20" y2="3" stroke="var(--act)" strokeWidth="2" strokeDasharray="4 4" />
            </svg>
            Health limits
            <Value value={COMFORT.healthTemp.lo} unit="Cel" sourceIds={COMFORT.sourceIds} size="sm" />–
            <Value value={COMFORT.healthTemp.hi} unit="Cel" sourceIds={COMFORT.sourceIds} size="sm" />
          </span>
          <span>Grey dots: the 6 days before; diamond: {missionDayLabel(day)}.</span>
        </figcaption>
      </figure>
    </Card>
  );
}
