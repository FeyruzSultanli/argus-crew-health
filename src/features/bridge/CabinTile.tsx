import { Wind } from 'lucide-react';

import { evaluateBands } from '../../domain/rules/bands';
import type { BandRule } from '../../domain/rules/bands';
import { CO2_SPACE_1H_RULE, CO2_SPACE_7D_RULE } from '../../domain/signals/cabinCo2';
import type { Assessment, SignalId } from '../../domain/types';
import { useAssessments } from '../../services/hooks';
import { Badge, Card, EmptyState, Gauge, LinkButton, Skeleton, StatusPill, VERDICT, Value } from '../../ui';

/** Upper end of the CO₂ ring scale (display only). */
const CO2_SCALE_MAX = 5;

interface Co2GaugeProps {
  value: number | null;
  label: string;
  /** Sourced space rule; its WATCH edge is the limit drawn on the ring. */
  rule: BandRule;
}

/** The rule's WATCH lower edge (3 mmHg 1-h [SRC_STD3001_CO2], 2.5 mmHg 7-day [SRC_NASA_CO2_PAGE]). */
function watchEdge(rule: BandRule): number | null {
  return rule.bands.find((b) => b.verdict === 'WATCH')?.min ?? null;
}

const SIZE = 128;

/** Gauge plus a tick at the sourced limit (3 mmHg 1-h, 2.5 mmHg 7-day). */
function Co2Gauge({ value, label, rule }: Co2GaugeProps) {
  const limit = watchEdge(rule) ?? 0;
  const sourceIds = rule.sourceIds;
  const verdict = value === null ? 'NO_DATA' : evaluateBands(rule, value).verdict;
  const r = (SIZE - 10) / 2;
  const theta = ((135 + 270 * (limit / CO2_SCALE_MAX)) * Math.PI) / 180;
  const p = (rad: number) => ({ x: SIZE / 2 + rad * Math.cos(theta), y: SIZE / 2 + rad * Math.sin(theta) });
  const a = p(r - 9);
  const b = p(r + 9);
  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <Gauge
        value={value}
        max={CO2_SCALE_MAX}
        label={`${label} · mmHg`}
        precision={1}
        sourceIds={sourceIds}
        tone={VERDICT[verdict].tone}
        size={SIZE}
        footer={<StatusPill verdict={verdict} size="sm" />}
      />
      <svg
        width={SIZE}
        height={SIZE}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
      >
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="var(--text)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
      <span className="inline-flex items-center gap-1 text-xs text-text-2">
        limit{' '}
        <Value
          value={limit}
          unit="mm[Hg]"
          precision={1}
          sourceIds={sourceIds}
          size="sm"
          title={`${label} limit`}
        />
      </span>
    </div>
  );
}

const pick = (list: readonly Assessment[], id: SignalId) => list.find((a) => a.signalId === id);

function Row({ a, unit, title }: { a: Assessment | undefined; unit: string; title: string }) {
  const v = a?.latest?.value ?? null;
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-text-2">{title}</span>
      <span className="flex items-center gap-2">
        <Value value={v} unit={unit} sourceIds={['SRC_STD3001_ECLSS']} size="sm" title={title} />
        <StatusPill verdict={a?.verdict ?? 'NO_DATA'} size="sm" />
      </span>
    </li>
  );
}

/** Cabin tile (doc 11 §5.1): CO₂ 1-h and 7-day rings with their limits, temperature and humidity. Simulated. */
export function CabinTile({ missionDay }: { missionDay: number }) {
  const list = useAssessments('cabin', missionDay);
  const co2 = list ? pick(list, 'cabin_co2') : undefined;
  const last1h = co2?.latest?.value ?? null;
  const avg7d = co2?.layers.space.numbers?.avg7d ?? co2?.latest?.components?.avg7d ?? null;
  return (
    <Card
      title="Cabin"
      subtitle="Air and climate"
      actions={
        <Badge variant="outline" mono>
          Simulated
        </Badge>
      }
      data-testid="cabin-tile"
    >
      {list === undefined ? (
        // Reserve about the loaded tile's height (≈ 458 px) so the tiles below do not jump (CLS).
        <Skeleton lines={4} label="Loading cabin" className="min-h-[22rem]" />
      ) : !co2?.latest ? (
        <EmptyState icon={Wind} title="No cabin readings" body="No cabin sensor data for this mission day." />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap justify-around gap-3">
            <Co2Gauge value={last1h} label="CO₂ 1-h" rule={CO2_SPACE_1H_RULE} />
            <Co2Gauge value={avg7d} label="CO₂ 7-day" rule={CO2_SPACE_7D_RULE} />
          </div>
          <ul className="divide-y divide-border border-t border-border">
            <Row a={pick(list, 'cabin_temp')} unit="Cel" title="Temperature" />
            <Row a={pick(list, 'cabin_humidity')} unit="%" title="Humidity" />
          </ul>
          <div>
            <LinkButton to="/environment" variant="ghost">
              Radiation &amp; cabin details
            </LinkButton>
          </div>
        </div>
      )}
    </Card>
  );
}
