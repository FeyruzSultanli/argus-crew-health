// Amsler result: per eye the marked map and count; after Save the new area since the last test (outlined) and the
// verdict from the assessments. Before Save it shows only what was marked.
import { RotateCcw, Save } from 'lucide-react';

import type { AmslerCells, AmslerDiff, PreviousMap } from '../../../measurement/vision';
import { Badge, Button, Card, ErrorState, Value } from '../../../ui';
import type { DataLabel } from '../../../ui';
import { AmslerGrid } from './AmslerGrid';
import { VisionVerdict } from './bits';
import { CALIBRATION_NOT_VERIFIED, eyeName, type Eye } from './observations';

export interface AmslerEyeResult {
  eye: Eye;
  cells: AmslerCells;
  diff: AmslerDiff;
  prev: PreviousMap;
}

export type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; ids: readonly string[] } | { kind: 'error'; message: string };

const SRC = ['SRC_VISION_ISS'] as const;
export const NEW_AREA_TEXT = 'new area since last test';

function DiffText({ r }: { r: AmslerEyeResult }) {
  const { prev, diff } = r;
  if (prev.kind === 'count-only') {
    return (
      <p className="text-sm text-text-2" data-testid={`amsler-diff-${r.eye}`}>
        Previous test (mission day {prev.missionDay}): {prev.count} squares marked; their positions were not stored, so squares beyond that
        number count as new.{diff.newCells > 0 ? ` Counted as ${NEW_AREA_TEXT}.` : ''}
      </p>
    );
  }
  const since =
    prev.kind === 'none'
      ? 'No earlier test of this eye on record — every marked square counts as new.'
      : prev.kind === 'empty'
        ? `Compared with the test of mission day ${prev.missionDay}, which had no marked squares.`
        : `Compared with the map of mission day ${prev.missionDay}.`;
  return (
    <p className="text-sm text-text-2" data-testid={`amsler-diff-${r.eye}`}>
      {since}{' '}
      {diff.newCells > 0 ? (
        <span className="font-semibold text-text">
          <span aria-hidden="true" className="mr-1 inline-block size-3 border-2 border-[#C8102E] align-middle" />
          Outlined in red: {NEW_AREA_TEXT}.
        </span>
      ) : (
        `No ${NEW_AREA_TEXT}.`
      )}
    </p>
  );
}

export interface AmslerResultProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  pxPerMm: number;
  results: readonly AmslerEyeResult[];
  testMode: boolean;
  save: SaveState;
  onSave: () => void;
  onRetake: () => void;
  onExit: () => void;
}

export function AmslerResult({ crewId, crewName, missionDay, pxPerMm, results, testMode, save, onSave, onRetake, onExit }: AmslerResultProps) {
  const saved = save.kind === 'saved';
  const label: DataLabel = testMode ? 'SIMULATED' : 'MEASURED';
  return (
    <section aria-labelledby="amsler-result" className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="amsler-result" className="text-xl font-semibold">
            Amsler result
          </h2>
          {!testMode && <Badge tone="brand">MEASURED · this device</Badge>}
        </div>
        {results.length === 0 && <p className="mt-3 text-sm text-text-2">Both eyes were skipped; there is nothing to save.</p>}
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {results.map((r) => (
            <div key={r.eye} className="flex flex-col gap-2" data-testid={`amsler-result-${r.eye}`}>
              <h3 className="font-semibold">{eyeName(r.eye)}</h3>
              <dl className="flex flex-wrap gap-6 text-sm">
                <div>
                  <dt className="text-text-2">Marked squares</dt>
                  <dd data-testid={`amsler-count-${r.eye}`} data-raw={r.diff.count}>
                    <Value value={r.diff.count} precision={0} sourceIds={SRC} label={label} title="Marked squares" />
                  </dd>
                </div>
                {saved && (
                  <div>
                    <dt className="text-text-2">New since last test</dt>
                    <dd data-testid={`amsler-new-${r.eye}`} data-raw={r.diff.newCells}>
                      <Value value={r.diff.newCells} precision={0} sourceIds={SRC} label={label} title="New squares since last test" />
                    </dd>
                  </div>
                )}
              </dl>
              <AmslerGrid
                pxPerMm={pxPerMm}
                scale={0.6}
                cells={r.cells}
                highlight={saved ? r.diff.newIndices : []}
                label={`${eyeName(r.eye)} map: ${r.diff.count} marked squares${saved && r.diff.newIndices.length > 0 ? `, ${r.diff.newIndices.length} outlined as ${NEW_AREA_TEXT}` : ''}.`}
                testId={`amsler-preview-${r.eye}`}
              />
              {saved && <DiffText r={r} />}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-text-3">{CALIBRATION_NOT_VERIFIED} Previews are shown at reduced size.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" icon={Save} disabled={save.kind === 'saving' || saved || results.length === 0} onClick={onSave}>
            {save.kind === 'saving' ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Button>
          <Button icon={RotateCcw} onClick={onRetake}>
            Retake
          </Button>
          <Button onClick={onExit}>Done</Button>
        </div>
        <div aria-live="polite" className="mt-3 text-sm">
          {saved && (
            <p className="text-ok-fg">
              Saved for {crewName}, mission day {missionDay}
              {testMode ? ' — labeled SIMULATED (scripted test mode).' : '.'}
            </p>
          )}
        </div>
        {save.kind === 'error' && <ErrorState className="mt-3" title="Not saved" message={save.message} />}
      </Card>
      <Card title="Verdict" headingLevel={3}>
        <VisionVerdict crewId={crewId} missionDay={missionDay} signalId="amsler" savedIds={saved ? save.ids : null} />
      </Card>
    </section>
  );
}
