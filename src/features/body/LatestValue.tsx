import { getSignal } from '../../domain/signals';
import type { Assessment } from '../../domain/types';
import { useMissionStore } from '../../state/mission';
import { Value } from '../../ui/Value';
import type { ValueProps } from '../../ui/Value';
import { observationSourceIds, readingAge } from './cardHelpers';

export interface LatestValueProps {
  assessment: Assessment;
  size?: ValueProps['size'];
  showFreshness?: boolean;
}

/** The latest reading through <Value> (each component of a multi-part reading, e.g. blood pressure). */
export function LatestValue({ assessment, size = 'md', showFreshness = false }: LatestValueProps) {
  const missionDay = useMissionStore((s) => s.missionDay);
  const o = assessment.latest;
  const title = getSignal(assessment.signalId).label;
  if (!o) return <Value value={null} sourceIds={[]} size={size} title={title} />;
  const common = {
    sourceIds: observationSourceIds(o),
    label: o.source.label,
    size,
    freshness: showFreshness ? readingAge(o, missionDay) : undefined,
  };
  if (o.value === null && o.components) {
    const parts = Object.entries(o.components);
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2">
        {parts.map(([k, v], i) => (
          <Value
            key={k}
            value={v}
            unit={o.unit}
            title={`${title}: ${k}`}
            {...common}
            label={i === parts.length - 1 ? common.label : undefined}
            freshness={i === parts.length - 1 ? common.freshness : undefined}
          />
        ))}
      </span>
    );
  }
  return <Value value={o.value} unit={o.unit} title={title} {...common} />;
}
