// "When ARGUS suggests it": the protocol's trigger text and whether it is met now for the subject (FR-HELP-3).
import { CircleAlert, CircleDashed, CircleMinus } from 'lucide-react';

import type { Protocol } from './content';
import { evaluateTrigger } from './content';
import { useAssessments } from '../../services/hooks';
import { useMissionStore } from '../../state/mission';
import { missionDayLabel } from '../../state/missionSelectors';
import { Badge } from '../../ui';
import { crewName } from '../settings/crewNames';
import { TaggedText } from './Markdown';
import { buildTriggerFacts, triggerState } from './triggerFacts';

const usesSpaceWeather = (p: Protocol) => JSON.stringify(p.triggerRule).includes('spaceWeather');

export function TriggerStatus({ protocol, crewId }: { protocol: Protocol; crewId: string | null }) {
  const day = useMissionStore((s) => s.missionDay);
  const crew = useAssessments(crewId ?? '__none__', day);
  const cabin = useAssessments('cabin', day);
  const facts = buildTriggerFacts(crewId ? crew : undefined, cabin, day);
  const met = evaluateTrigger(protocol.triggerRule, facts);
  const state = crewId ? triggerState(met, crew) : 'no-data';
  const who = crewName(crewId);
  return (
    <section aria-labelledby="trigger-h" className="flex flex-col gap-2" data-testid="trigger-status">
      <h2 id="trigger-h" className="text-sm font-semibold text-text">
        When ARGUS suggests it
      </h2>
      <p className="text-sm leading-[1.85] text-text-2">
        <TaggedText text={protocol.triggerPlain} />
      </p>
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {state === 'met' && (
          <Badge tone="watch" icon={CircleAlert} data-state="met">
            Trigger met now for {who} ({missionDayLabel(day)})
          </Badge>
        )}
        {state === 'not-met' && (
          <Badge icon={CircleMinus} data-state="not-met">
            Trigger not met now for {who} ({missionDayLabel(day)})
          </Badge>
        )}
        {state === 'no-data' && (
          <Badge icon={CircleDashed} data-state="no-data">
            {crewId ? `No assessments for ${who} yet` : 'No crew member selected'}
          </Badge>
        )}
      </div>
      {usesSpaceWeather(protocol) && (
        <p className="text-xs text-text-3">
          Space-weather facts are not connected to this screen yet; a missing fact never satisfies a
          condition.
        </p>
      )}
    </section>
  );
}
