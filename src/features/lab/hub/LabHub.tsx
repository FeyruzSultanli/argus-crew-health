// /lab — Measurement Lab hub (doc 11 §5.4, doc 09 intro): subject picker + six tiles with last measured, due
// status and duration. The flight surgeon gets a read-only explanation (doc 05 §7).
import type { Observation } from '../../../domain/types';
import { useObservations } from '../../../services/hooks';
import { useTodayPlan } from '../labData';
import { useLabSubject } from '../subject';
import { SurgeonNotice } from '../SurgeonNotice';
import { LabTile } from './LabTile';
import { SubjectPicker } from './SubjectPicker';
import { TILES, type TileDef } from './tiles';

/** Look-back window for "last measured" (weekly tests fit comfortably). */
const LOOKBACK_DAYS = 30;

function latestFor(tile: TileDef, obs: readonly Observation[] | undefined): Observation | undefined {
  if (!obs) return undefined;
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i] as Observation;
    if (tile.signals.includes(o.signalId) && (!tile.kinds || tile.kinds.includes(o.source.kind))) return o;
  }
  return undefined;
}

export function LabHub() {
  const subject = useLabSubject();
  const { crewId, missionDay } = subject;
  const obs = useObservations({ crewId: crewId ?? '—', fromDay: missionDay - LOOKBACK_DAYS, toDay: missionDay });
  const plan = useTodayPlan(crewId ?? '—', missionDay);
  return (
    <section aria-labelledby="lab-title" className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 id="lab-title" className="text-2xl font-semibold text-text">
          Measurement Lab
        </h1>
        <p className="text-sm text-text-2">
          Measure with what is on board — the laptop camera and screen, or values from the medical kit. Every result goes
          into the same personal, space and Earth evaluation.
        </p>
      </header>
      {crewId === null && !subject.needsPick ? (
        <SurgeonNotice />
      ) : (
        <>
          <SubjectPicker subject={subject} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TILES.map((t) => (
              <LabTile
                key={t.id}
                tile={t}
                last={crewId ? latestFor(t, obs) : undefined}
                tasks={crewId ? plan?.filter((task) => task.kind === 'measure' && task.signalId !== undefined && t.signals.includes(task.signalId)) : undefined}
                noSubject={crewId === null}
                missionDay={missionDay}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
