import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Download, ImageDown, Info, Satellite } from 'lucide-react';

import crewJson from '../../../seed/crew.json';
import type { SignalId } from '../../domain/types';
import { useAssessments } from '../../services/hooks';
import { useMissionStore } from '../../state/mission';
import { missionDayLabel } from '../../state/missionSelectors';
import { useSessionStore } from '../../state/session';
import { Button, LinkButton } from '../../ui/Button';
import { EmptyState } from '../../ui/States';
import { Switch } from '../../ui/Switch';
import { DEFAULT_PRESET, clampRange, presetRange } from './axis';
import type { DayRange, RangePreset } from './axis';
import { ChartBoundary } from './ChartCard';
import { Co2TrendCard } from './Co2TrendCard';
import { buildCsv } from './csv';
import type { CsvChart } from './csv';
import { CrewTabs } from './CrewTabs';
import { downloadBlob } from './download';
import { composeSvg, svgToPng } from './pngExport';
import { RangeControls } from './RangeControls';
import { DEFAULT_SIGNALS, loadSelection, saveSelection, toggleSignal, trendsAccess } from './selection';
import { SignalPicker } from './SignalPicker';
import { SignalTrendCard } from './SignalTrendCard';

const CREW_IDS = crewJson.crew.map((c) => c.id);

/** Trends — small multiples on a shared mission-day axis (doc 11 §5.3, doc 08 §6, FR-BAS-6). */
export default function TrendsPage() {
  const { crewId: paramId } = useParams();
  const role = useSessionStore((s) => s.role);
  const ownId = useSessionStore((s) => s.crewId);
  const access = trendsAccess(role, ownId, paramId, CREW_IDS);
  if (access.kind === 'surgeon') return <SurgeonTrends />;
  if (access.kind === 'signed-out') {
    return (
      <EmptyState
        icon={Info}
        title="Sign in to see trends"
        body="Trends are shown for the signed-in crew member."
      />
    );
  }
  return (
    <TrendsView
      key={access.crewId}
      crewId={access.crewId}
      canPickCrew={access.canPickCrew}
      redirectedFrom={access.redirectedFrom}
    />
  );
}

function SurgeonTrends() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold text-text">Trends</h1>
      <EmptyState
        icon={Satellite}
        title="Trends for the flight surgeon come from received packets"
        body="On-board trends stay with the crew. The flight surgeon sees the data that has arrived over the Earth link."
        action={
          <LinkButton to="/earth" variant="primary">
            Open Earth link
          </LinkButton>
        }
      />
    </div>
  );
}

function TrendsView({
  crewId,
  canPickCrew,
  redirectedFrom,
}: {
  crewId: string;
  canPickCrew: boolean;
  redirectedFrom?: string;
}) {
  const missionDay = useMissionStore((s) => s.missionDay);
  const [selected, setSelected] = useState<SignalId[]>(loadSelection);
  const [preset, setPreset] = useState<RangePreset | null>(DEFAULT_PRESET);
  const [custom, setCustom] = useState<DayRange | null>(null);
  const [compare, setCompare] = useState(false);
  const assessments = useAssessments(crewId, missionDay);
  const cabin = useAssessments('cabin', missionDay);
  const csvCharts = useRef(new Map<string, CsvChart>());
  const gridRef = useRef<HTMLDivElement>(null);
  const [pngError, setPngError] = useState<string | null>(null);
  const name = crewJson.crew.find((c) => c.id === crewId)?.displayName ?? crewId;

  const range = useMemo(
    () =>
      preset === null && custom
        ? clampRange(custom, missionDay)
        : presetRange(preset ?? DEFAULT_PRESET, missionDay),
    [preset, custom, missionDay],
  );
  const choose = (ids: SignalId[]) => {
    setSelected(ids);
    saveSelection(ids);
  };
  const selectRange = useCallback((r: DayRange) => {
    setCustom(r);
    setPreset(null);
  }, []);
  const onCsv = useCallback((key: string, chart: CsvChart | null) => {
    if (chart) csvCharts.current.set(key, chart);
    else csvCharts.current.delete(key);
  }, []);
  const fileStem =
    `argus-trends-${crewId}-${missionDayLabel(range.fromDay)}-${missionDayLabel(range.toDay)}`.replace(
      /\s/g,
      '',
    );
  const exportPng = async () => {
    setPngError(null);
    const root = gridRef.current;
    const composed = root
      ? composeSvg(root, {
          title: `ARGUS Trends · ${name} · ${missionDayLabel(range.fromDay)} to ${missionDayLabel(range.toDay)}`,
          subtitle:
            'SIMULATED DATA (demo mission). Not a medical device. Source ids per chart below each panel.',
        })
      : null;
    if (!composed) {
      setPngError('No chart is drawn yet.');
      return;
    }
    try {
      downloadBlob(`${fileStem}.png`, await svgToPng(composed.svg, composed.width, composed.height));
    } catch (e) {
      setPngError(e instanceof Error ? e.message : 'PNG export failed.');
    }
  };
  const exportCsv = () => {
    const order = [...selected, 'cabin_co2'];
    const charts = order.map((k) => csvCharts.current.get(k)).filter((c): c is CsvChart => c !== undefined);
    const text = buildCsv(charts);
    downloadBlob(
      `argus-trends-${crewId}-${missionDayLabel(range.fromDay)}-${missionDayLabel(range.toDay)}.csv`.replace(
        /\s/g,
        '',
      ),
      new Blob([text], { type: 'text/csv;charset=utf-8' }),
    );
  };

  return (
    <div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-6 lg:px-6"
      data-testid="trends-page"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">Trends</h1>
          <p className="text-sm text-text-2">
            {name} · {missionDayLabel(range.fromDay)} to {missionDayLabel(range.toDay)} · drag across any
            chart to zoom all charts
          </p>
          {redirectedFrom && (
            <p className="mt-1 text-xs text-text-2" role="status">
              Crew members see their own trends; showing yours.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canPickCrew && (
            <Switch
              checked={compare}
              onChange={setCompare}
              label="Compare crew"
              description="Overlay the other crew members' daily values"
            />
          )}
          <Button variant="secondary" icon={Download} onClick={exportCsv} data-testid="export-csv">
            Export CSV
          </Button>
          <Button
            variant="secondary"
            icon={ImageDown}
            onClick={() => void exportPng()}
            data-testid="export-png"
          >
            Export PNG
          </Button>
          {pngError && (
            <p role="alert" className="text-xs text-act-fg">
              {pngError}
            </p>
          )}
        </div>
      </header>
      {canPickCrew && <CrewTabs current={crewId} />}
      <SignalPicker
        selected={selected}
        assessments={assessments}
        onToggle={(id) => choose(toggleSignal(selected, id))}
        onReset={() => choose([...DEFAULT_SIGNALS])}
      />
      <RangeControls
        preset={preset}
        range={range}
        todayDay={missionDay}
        onPreset={(p) => {
          setPreset(p);
          setCustom(null);
        }}
        onRange={selectRange}
        onReset={() => {
          setPreset(DEFAULT_PRESET);
          setCustom(null);
        }}
      />
      <div ref={gridRef} className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {selected.map((id) => (
          <ChartBoundary key={id} title={id}>
            <SignalTrendCard
              crewId={crewId}
              signalId={id}
              range={range}
              todayDay={missionDay}
              assessment={assessments?.find((a) => a.signalId === id)}
              compare={canPickCrew && compare}
              onCsv={onCsv}
              onSelectRange={selectRange}
            />
          </ChartBoundary>
        ))}
        <ChartBoundary title="Cabin CO₂">
          <Co2TrendCard
            range={range}
            todayDay={missionDay}
            verdict={cabin?.find((a) => a.signalId === 'cabin_co2')?.verdict}
            onCsv={onCsv}
            onSelectRange={selectRange}
          />
        </ChartBoundary>
      </div>
    </div>
  );
}
