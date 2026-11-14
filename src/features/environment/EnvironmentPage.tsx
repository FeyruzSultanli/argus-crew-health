// /environment — Radiation & cabin environment (doc 11 §5.5, doc 10). Open to every role (doc 05 §7); the per-crew
// dose ledger is crew data: crew see their own row, the CMO all rows, the flight surgeon none.
import { useEffect } from 'react';
import { ShieldOff } from 'lucide-react';

import { setEnvironmentVisible } from '../../services/spaceWeather';
import {
  useCrew,
  useDoseLedgers,
  useEnvironment,
  useShelterAdvisory,
  useSpaceWeatherView,
} from '../../services/hooks';
import { useMissionProfile, useMissionStore } from '../../state/mission';
import { useSessionStore } from '../../state/session';
import { Card, EmptyState, Skeleton, formatAge } from '../../ui';
import type { Tone } from '../../ui';
import { Co2Card } from './Co2Card';
import { ComfortPlot } from './ComfortPlot';
import { DataModeBar } from './DataModeBar';
import { DonkiCard } from './DonkiCard';
import { DoseLedgerCard } from './DoseLedgerCard';
import { FluxChart } from './FluxChart';
import { ReplayControls } from './ReplayControls';
import { SScaleTile } from './SScaleTile';
import { ShelterBanner } from './ShelterBanner';
import { SpeMeter } from './SpeMeter';
import { useSpaceWeatherStore } from '../../services/spaceWeather';
import { useNow } from './useNow';

const ADVISORY_TONE: Record<'ACT' | 'WATCH' | 'info', Tone> = { ACT: 'act', WATCH: 'watch', info: 'info' };

function Loading({ label }: { label: string }) {
  return (
    <Card>
      <Skeleton variant="block" label={label} className="h-40" />
    </Card>
  );
}

export default function EnvironmentPage() {
  const missionDay = useMissionStore((s) => s.missionDay);
  const profile = useMissionProfile();
  const role = useSessionStore((s) => s.role);
  const ownId = useSessionStore((s) => s.crewId);
  const view = useSpaceWeatherView();
  const donki = useSpaceWeatherStore((s) => s.donki);
  const advisory = useShelterAdvisory();
  const allLedgers = useDoseLedgers(missionDay);
  const env = useEnvironment(missionDay);
  const crew = useCrew();
  const now = useNow(30_000);

  useEffect(() => {
    setEnvironmentVisible(true);
    return () => setEnvironmentVisible(false);
  }, []);

  const ledgers =
    role === 'cmo' ? allLedgers : role === 'crew' ? allLedgers?.filter((l) => l.crewId === ownId) : [];
  const dataNow = view?.replay ? view.replay.startMs + view.replay.eventMs : now;
  const freshness =
    view?.state.mode === 'LIVE' && view.state.fetchedAt
      ? formatAge(Math.max(0, (now - Date.parse(view.state.fetchedAt)) / 60_000))
      : undefined;
  const co2 = env?.assessments.find((a) => a.signalId === 'cabin_co2');
  const temp = env?.assessments.find((a) => a.signalId === 'cabin_temp');
  const rh = env?.assessments.find((a) => a.signalId === 'cabin_humidity');

  return (
    <section aria-labelledby="env-title" className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 id="env-title" className="text-2xl font-semibold text-text">
          Radiation &amp; cabin
        </h1>
        <DataModeBar view={view} now={now} />
      </header>

      <ReplayControls />

      {view && advisory && <ShelterBanner advisory={advisory} view={view} nowMs={dataNow} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)_minmax(0,1fr)]">
        {view ? (
          <>
            <SScaleTile
              view={view}
              freshness={freshness}
              tone={advisory ? ADVISORY_TONE[advisory.level] : undefined}
            />
            <FluxChart view={view} />
          </>
        ) : (
          <>
            <Loading label="Loading space weather" />
            <Loading label="Loading proton flux" />
          </>
        )}
        <div className="lg:col-span-2 xl:col-span-1">
          <DonkiCard donki={donki} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {role === 'surgeon' ? (
          <Card title="Dose ledger">
            <EmptyState
              icon={ShieldOff}
              title="Per-crew dose is crew data"
              body="The flight-surgeon role does not see the per-crew dose ledger on this screen. Cabin and space-weather data stay visible."
            />
          </Card>
        ) : ledgers && crew ? (
          <DoseLedgerCard ledgers={ledgers} crew={crew} profile={profile} missionDay={missionDay} />
        ) : (
          <Loading label="Loading dose ledger" />
        )}
        {view ? <SpeMeter view={view} /> : <Loading label="Loading modeled solar-event dose" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {env ? (
          <>
            <Co2Card env={env} co2={co2} />
            <ComfortPlot env={env} temp={temp} humidity={rh} />
          </>
        ) : (
          <>
            <Loading label="Loading cabin CO₂" />
            <Loading label="Loading cabin temperature and humidity" />
          </>
        )}
      </div>
    </section>
  );
}
