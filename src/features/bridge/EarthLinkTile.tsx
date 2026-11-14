import { RadioTower } from 'lucide-react';

import { useMissionProfile } from '../../state/mission';
import { DELAY_SOURCE_IDS, commsDelaySec, delayDisplay, isModeledDelay } from '../../state/missionSelectors';
import { Card, LinkButton, Value } from '../../ui';

/**
 * Earth link tile (doc 11 §5.1): one-way delay now (mission profile, SRC_DEMO_SIMULATION). Next-message ETA and
 * last received are placeholders until the Earth link provides messages — no invented values.
 */
export function EarthLinkTile({ missionDay }: { missionDay: number }) {
  const profile = useMissionProfile();
  const d = delayDisplay(commsDelaySec(profile, missionDay));
  const modeled = isModeledDelay(profile);
  return (
    <Card title="Earth link" subtitle="Flight surgeon on Earth" data-testid="earth-link-tile">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <RadioTower size={20} aria-hidden="true" className="shrink-0 text-text-2" />
          <span className="flex flex-col gap-0.5">
            <span className="text-xs text-text-2">One-way delay now</span>
            <span className="flex flex-wrap items-center gap-2" data-testid="earth-delay">
              <Value
                value={d.value}
                unit={d.unit}
                precision={d.precision}
                sourceIds={DELAY_SOURCE_IDS}
                size="lg"
                title="One-way comms delay"
              />
              {modeled && <span className="text-xs text-text-2">modeled delay (demo)</span>}
            </span>
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-text-2">Next message ETA</dt>
          <dd className="text-text-3">— no message in transit</dd>
          <dt className="text-text-2">Last received</dt>
          <dd className="text-text-3">— message log connects here</dd>
        </dl>
        <div>
          <LinkButton to="/earth" variant="ghost">
            Open Earth link
          </LinkButton>
        </div>
      </div>
    </Card>
  );
}
