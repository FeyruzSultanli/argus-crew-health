// Reaction Self-Test result (doc 09 §4): speed, median RT, lapses, false starts, performance score; Save / Retake.
// The personal band, lapses vs baseline, sleep and verdict come in through `evaluation` (route wrapper, domain data).
import { MonitorSmartphone, RotateCcw, Save } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { PVT_DEMO_SOURCE_ID, PVT_PARAMS, type PvtScore } from '../../../measurement/pvt';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { ErrorState } from '../../../ui/States';
import { Value } from '../../../ui/Value';
import type { DataLabel } from '../../../ui/SourceBadge';
import { TestModeBadge } from './bits';
import { PVT_METHOD_SOURCE } from './observation';
import type { PvtTestMode } from './testMode';

export type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

export interface PvtResultProps {
  score: PvtScore;
  seed: number;
  crewName: string;
  missionDay: number;
  isPractice: boolean;
  testMode: PvtTestMode | null;
  /** null when the result can be saved; otherwise why not. */
  blockedReason: string | null;
  save: SaveState;
  onSave: () => void;
  onRetake: () => void;
  onExit?: () => void;
  /** Comparison block (personal band, lapses vs baseline, sleep, verdict) — supplied by the route wrapper. */
  evaluation?: ReactNode;
}

interface MetricProps {
  label: string;
  value: number | null;
  unit?: string;
  precision?: number;
  testId: string;
  sourceIds: readonly string[];
  dataLabel: DataLabel;
}

function Metric({ label, value, unit, precision, testId, sourceIds, dataLabel }: MetricProps) {
  return (
    <div className="rounded-control border border-border bg-surface-2 p-3">
      <dt className="text-sm text-text-2">{label}</dt>
      <dd className="mt-1" data-testid={testId} data-raw={value ?? ''}>
        <Value value={value} unit={unit} precision={precision} size="lg" sourceIds={sourceIds} label={dataLabel} title={label} />
      </dd>
    </div>
  );
}

export function PvtResult(props: PvtResultProps) {
  const { score, seed, crewName, missionDay, isPractice, testMode, blockedReason, save, onSave, onRetake, onExit, evaluation } = props;
  const busy = save.kind === 'saving' || save.kind === 'saved';
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The focus overlay just closed: move keyboard focus to the result.
  useEffect(() => headingRef.current?.focus(), []);
  const dataLabel: DataLabel = testMode ? 'SIMULATED' : 'MEASURED';
  const src = PVT_METHOD_SOURCE;
  return (
    <section aria-labelledby="pvt-result" className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="pvt-result" ref={headingRef} tabIndex={-1} className="text-xl font-semibold focus-visible:outline-2 focus-visible:outline-brand">
            Result
          </h2>
          {testMode ? <TestModeBadge profile={testMode.profile} /> : <Badge tone="brand">MEASURED · this device</Badge>}
          {isPractice && <Badge tone="info">Practice run</Badge>}
        </div>
        <div role="status" aria-live="polite" className="mt-4">
          <p className="sr-only">
            Mean response speed {score.meanSpeed?.toFixed(2) ?? 'not available'} per second, {score.lapses} lapses,{' '}
            {score.falseStarts} false starts, {score.nStimuli} stimuli.
          </p>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Metric label="Mean response speed" value={score.meanSpeed} unit="/s" precision={2} testId="pvt-speed" sourceIds={src} dataLabel={dataLabel} />
            <Metric label="Median reaction time" value={score.medianRtMs === null ? null : Math.round(score.medianRtMs)} unit="ms" precision={0} testId="pvt-median" sourceIds={src} dataLabel={dataLabel} />
            <Metric label="Lapses (slow responses)" value={score.lapses} precision={0} testId="pvt-lapses" sourceIds={src} dataLabel={dataLabel} />
            <Metric label="False starts" value={score.falseStarts} precision={0} testId="pvt-false-starts" sourceIds={[PVT_DEMO_SOURCE_ID]} dataLabel={dataLabel} />
            <Metric label="Stimuli" value={score.nStimuli} precision={0} testId="pvt-stimuli" sourceIds={src} dataLabel={dataLabel} />
            <Metric
              label="Performance score"
              value={score.performanceScore === null ? null : Math.round(score.performanceScore * 100)}
              unit="%"
              precision={0}
              testId="pvt-score"
              sourceIds={src}
              dataLabel={dataLabel}
            />
          </dl>
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm text-text-2">
          <MonitorSmartphone aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-info" />
          Use the same device for comparable results.
        </p>
        {blockedReason && <ErrorState className="mt-4" title="This result cannot be saved" message={blockedReason} />}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" icon={Save} disabled={busy || blockedReason !== null} onClick={onSave}>
            {save.kind === 'saving' ? 'Saving…' : save.kind === 'saved' ? 'Saved' : 'Save'}
          </Button>
          <Button icon={RotateCcw} onClick={onRetake}>
            Retake
          </Button>
          {onExit && <Button onClick={onExit}>Done</Button>}
        </div>
        <div aria-live="polite" className="mt-3 text-sm">
          {save.kind === 'saved' && (
            <p className="text-ok-fg">
              Saved for {crewName}, mission day {missionDay}
              {testMode ? ' — labeled SIMULATED (scripted test mode).' : '.'}
            </p>
          )}
        </div>
        {save.kind === 'error' && <ErrorState className="mt-3" title="Not saved" message={save.message} />}
      </Card>

      {evaluation}

      <Card title="How this test is scored" headingLevel={3}>
        <ul className="flex list-inside list-disc flex-col gap-2 text-sm text-text-2">
          <li>
            Duration <Value value={PVT_PARAMS.durationMs / 60000} unit="min" sourceIds={src} title="Test duration" />; the box
            appears after a random wait of <Value value={PVT_PARAMS.isiMaxMs / 1000} prefix={`${PVT_PARAMS.isiMinMs / 1000}–`} unit="s" sourceIds={src} title="Inter-stimulus interval" />;
            a reaction this slow or slower is a lapse: <Value value={PVT_PARAMS.lapseMs} unit="ms" sourceIds={src} title="Lapse threshold" />.
          </li>
          <li>
            A press before the box, or faster than <Value value={PVT_PARAMS.falseStartMs} unit="ms" sourceIds={[PVT_DEMO_SOURCE_ID]} title="False-start threshold" />,
            is a false start (usual PVT convention, not re-checked at source). No press within{' '}
            <Value value={PVT_PARAMS.timeoutMs / 1000} unit="s" sourceIds={[PVT_DEMO_SOURCE_ID]} title="Timeout" /> counts as a lapse.
          </li>
          <li>Speed = mean of 1000 / reaction time over valid responses (false starts excluded).</li>
          <li>Performance score = 1 − (lapses + false starts) / stimuli.</li>
          <li className="font-mono text-xs text-text-3">ISI seed {seed}</li>
        </ul>
      </Card>
    </section>
  );
}
