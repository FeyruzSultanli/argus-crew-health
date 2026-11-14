// Verdict for the saved camera reading (doc 11 §5.4): StatusPill + LayerTriad of today's heart_rate_rest assessment
// and its action text verbatim (doc 07). Shown only once the domain has evaluated a reading of today.
import { LayerTriad } from '../../../ui/LayerTriad';
import { StatusPill } from '../../../ui/StatusPill';
import { useAssessments } from '../labData';

export const CAMERA_VERDICT_PENDING = 'Verdict appears once the reading is evaluated.';

export function CameraEvaluation({ crewId, missionDay }: { crewId: string; missionDay: number }) {
  const a = useAssessments(crewId, missionDay)?.find((x) => x.signalId === 'heart_rate_rest');
  const current = a && a.missionDay === missionDay && a.latest?.missionDay === missionDay;
  return (
    <div className="mt-3 border-t border-border pt-3" aria-live="polite">
      {current ? (
        <div className="flex flex-col gap-3" data-testid="cp-verdict">
          <StatusPill verdict={a.verdict} showMeaning />
          <LayerTriad
            layers={a.layers}
            drivenBy={a.drivenBy}
            caughtOnlyByPersonal={a.caughtOnlyByPersonal}
            variant="expanded"
          />
          {a.action.kind !== 'none' && (
            <p className="text-sm text-text" data-testid="cp-action">
              {a.action.text}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-2" data-testid="cp-verdict-pending">
          {CAMERA_VERDICT_PENDING}
        </p>
      )}
    </div>
  );
}
