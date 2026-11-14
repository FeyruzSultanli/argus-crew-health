// healthService.environment(missionDay) (doc 10 §9): the cabin snapshot from the simulated cabin observations
// (crewId 'cabin') plus the three cabin assessments. The maths is pure (domain/environment/cabin.ts).
import { buildEnvironmentSnapshot } from '../domain/environment/cabin';
import type { Assessment, EnvironmentSnapshot, ObsQuery, Observation, SignalId } from '../domain/types';

const CABIN_SIGNALS: readonly SignalId[] = ['cabin_co2', 'cabin_temp', 'cabin_humidity'];

export interface EnvironmentDeps {
  observations: (q: ObsQuery) => Promise<Observation[]>;
  assess: (crewId: 'cabin', missionDay: number) => Promise<Assessment[]>;
}

export async function environmentFor(
  missionDay: number,
  deps: EnvironmentDeps,
): Promise<EnvironmentSnapshot> {
  const [assessments, co2, temp, humidity] = await Promise.all([
    deps.assess('cabin', missionDay),
    deps.observations({ crewId: 'cabin', signalId: 'cabin_co2', toDay: missionDay }),
    deps.observations({ crewId: 'cabin', signalId: 'cabin_temp', toDay: missionDay }),
    deps.observations({ crewId: 'cabin', signalId: 'cabin_humidity', toDay: missionDay }),
  ]);
  return buildEnvironmentSnapshot(
    missionDay,
    { co2, temp, humidity },
    assessments.filter((a) => CABIN_SIGNALS.includes(a.signalId)),
  );
}
