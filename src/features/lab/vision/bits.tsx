// Small shared pieces of the vision check: the screening banner, test-mode badge, verdict block, distance step.
import { BookOpen, FlaskConical, Info, Ruler } from 'lucide-react';
import type { ReactNode } from 'react';

import type { SignalId } from '../../../domain/types';
import { Badge, Button, Card, LayerTriad, LinkButton, StatusPill } from '../../../ui';
import { useAssessments } from '../labData';
import { TEST_MODE_TEXT } from './observations';

export const SCREENING_TEXT = 'Screening only — not a diagnosis.';

export function ScreeningBanner() {
  return (
    <p role="note" className="flex items-center gap-2 rounded-control border border-info-border bg-surface-2 px-3 py-2 text-sm font-semibold text-text" data-testid="vision-screening">
      <Info aria-hidden="true" size={18} className="shrink-0 text-info" />
      {SCREENING_TEXT}
    </p>
  );
}

export function VisionTestModeBadge() {
  return (
    <Badge tone="watch" icon={FlaskConical} data-testid="vision-test-mode" className="h-8 border-2 px-3 font-mono text-sm font-semibold">
      {TEST_MODE_TEXT}
    </Badge>
  );
}

export function HandbookLink() {
  return (
    <LinkButton to="/handbook/measure-vision-check" icon={BookOpen} variant="ghost">
      About the ISS laptop vision tests and SANS
    </LinkButton>
  );
}

export const VERDICT_PENDING = 'The verdict appears after Save, once the reading is evaluated.';

/** Verdict of the saved readings: StatusPill + layers + the domain's action text verbatim (+ protocol link). */
export function VisionVerdict({ crewId, missionDay, signalId, savedIds }: { crewId: string; missionDay: number; signalId: SignalId; savedIds: readonly string[] | null }) {
  const a = useAssessments(crewId, missionDay)?.find((x) => x.signalId === signalId);
  const current = savedIds !== null && a?.latest !== undefined && savedIds.includes(a.latest.id);
  return (
    <div aria-live="polite" data-testid={`vision-verdict-${signalId}`}>
      {current && a ? (
        <div className="flex flex-col gap-3" data-testid="vision-verdict" data-verdict={a.verdict}>
          <StatusPill verdict={a.verdict} showMeaning />
          <LayerTriad layers={a.layers} drivenBy={a.drivenBy} caughtOnlyByPersonal={a.caughtOnlyByPersonal} variant="expanded" />
          {a.action.kind !== 'none' && (
            <p className="text-sm text-text" data-testid="vision-action">
              {a.action.text}
            </p>
          )}
          {a.action.kind === 'protocol' && a.action.protocolId && (
            <div>
              <LinkButton to={`/handbook/${a.action.protocolId}`} icon={BookOpen}>
                Open protocol
              </LinkButton>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-2" data-testid="vision-verdict-pending">
          {VERDICT_PENDING}
        </p>
      )}
    </div>
  );
}

/** Viewing-distance step without the camera: the user measures with a ruler (quality 'fair', doc 09 §3.1). */
export function DistanceStep({ distance, children, onRuler, camera }: { distance: ReactNode; children?: ReactNode; onRuler: () => void; camera?: ReactNode }) {
  return (
    <Card title="Viewing distance" headingLevel={2}>
      <p className="text-sm text-text-2">
        Sit {distance} from the screen, measured from your eyes to the screen.
      </p>
      {children}
      <div className="mt-4 flex flex-col gap-4">
        {camera}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Ruler} onClick={onRuler}>
            I measured the distance with a ruler
          </Button>
          <span className="text-sm text-text-2">A ruler-measured distance is saved as quality “fair”.</span>
        </div>
      </div>
    </Card>
  );
}
