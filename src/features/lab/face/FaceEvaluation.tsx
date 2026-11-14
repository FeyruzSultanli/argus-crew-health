// The domain's verdict for the saved scan (docs/07 §4.12): StatusPill + LayerTriad of the face_fluid_index
// assessment whose latest reading is the scan just saved, as the real rule returns it (the trend-only line is in the result card).
import { LayerTriad } from '../../../ui/LayerTriad';
import { StatusPill } from '../../../ui/StatusPill';
import { useAssessments } from '../labData';
import { RULE_WORDING_NOTE } from './copy';

export const FACE_VERDICT_PENDING = 'The rule result appears once the scan is evaluated.';

export function FaceEvaluation({ crewId, missionDay, savedId }: { crewId: string; missionDay: number; savedId: string }) {
  const a = useAssessments(crewId, missionDay)?.find((x) => x.signalId === 'face_fluid_index');
  const current = a && a.latest?.id === savedId;
  return (
    <div className="mt-3 border-t border-border pt-3" aria-live="polite">
      {current ? (
        <div className="flex flex-col gap-3" data-testid="fs-verdict">
          <StatusPill verdict={a.verdict} showMeaning />
          <LayerTriad layers={a.layers} drivenBy={a.drivenBy} caughtOnlyByPersonal={a.caughtOnlyByPersonal} variant="expanded" />
          {a.action.kind !== 'none' && (
            <p className="text-sm text-text" data-testid="fs-action">
              {a.action.text}
            </p>
          )}
          <p className="text-xs text-text-3">{RULE_WORDING_NOTE}</p>
        </div>
      ) : (
        <p className="text-sm text-text-2" data-testid="fs-verdict-pending">
          {FACE_VERDICT_PENDING}
        </p>
      )}
    </div>
  );
}
