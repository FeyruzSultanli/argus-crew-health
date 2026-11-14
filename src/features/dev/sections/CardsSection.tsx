import { BookOpen, Crosshair, Send } from 'lucide-react';

import {
  mockAssessments,
  mockOseiHeartRateAct,
  mockOseiHeartRateSeries,
  mockSleepExpected,
} from '../../../test/fixtures';
import type { Assessment } from '../../../domain/types';
import { ActionCard } from '../../../ui/ActionCard';
import { BandChart } from '../../../ui/BandChart';
import { Card } from '../../../ui/Card';
import { HowTo } from '../../../ui/HowTo';
import { LayerTriad } from '../../../ui/LayerTriad';
import { SignalCard } from '../../../ui/SignalCard';
import { Sparkline } from '../../../ui/Sparkline';
import { Value } from '../../../ui/Value';
import { Demo, GallerySection } from './GallerySection';

const LABEL: Partial<Record<Assessment['signalId'], string>> = {
  heart_rate_rest: 'Resting heart rate',
  sleep_duration: 'Sleep (3-night mean)',
  glucose: 'Blood glucose',
};

const PRIMARY: Record<
  Assessment['action']['kind'],
  { label: string; icon: typeof Crosshair; to: string } | undefined
> = {
  none: undefined,
  remeasure: { label: 'Measure', icon: Crosshair, to: '/lab' },
  'tell-cmo': { label: 'Send to Earth', icon: Send, to: '/earth' },
  'notify-surgeon': { label: 'Send to Earth', icon: Send, to: '/earth' },
  protocol: { label: 'Open protocol', icon: BookOpen, to: '/handbook/suspected-infection' },
};

export function CardsSection() {
  const osei = mockOseiHeartRateAct;
  return (
    <GallerySection id="cards" title="Cards">
      <Demo name="ActionCard" note="Tinted by verdict. Texts are doc 07 templates.">
        <div className="flex flex-col gap-3">
          {mockAssessments
            .filter((a) => a.action.text)
            .map((a) => (
              <ActionCard
                key={`${a.crewId}-${a.signalId}`}
                verdict={a.verdict}
                text={a.action.text}
                kind={a.action.kind}
                primary={PRIMARY[a.action.kind]}
                wordingTag="source"
              />
            ))}
        </div>
      </Demo>
      <Demo
        name="SignalCard"
        note="Collapsed in every verdict; the first is expanded with the six FR-SIG-4 slots."
      >
        <div className="flex flex-col gap-2">
          <SignalCard
            defaultExpanded
            title="Resting heart rate · K. Osei"
            verdict={osei.verdict}
            value={
              <Value
                value={69}
                unit="/min"
                sourceIds={['SRC_DEMO_BASELINE_ENGINE']}
                freshness="3 h"
                label="SIMULATED"
                title="Resting heart rate"
              />
            }
            layers={osei.layers}
            drivenBy={osei.drivenBy}
            caughtOnlyByPersonal={osei.caughtOnlyByPersonal}
            sparkline={
              <Sparkline
                points={mockOseiHeartRateSeries}
                ariaLabel="Resting heart rate, days 127 to 143, rising above the personal band"
              />
            }
            action={
              <ActionCard
                verdict={osei.verdict}
                text={osei.action.text}
                kind={osei.action.kind}
                primary={PRIMARY.protocol}
                wordingTag="source"
              />
            }
            why={<p className="text-sm text-text">{osei.explanation}</p>}
            layerDetail={
              <LayerTriad
                variant="expanded"
                layers={osei.layers}
                drivenBy={osei.drivenBy}
                caughtOnlyByPersonal
              />
            }
            chart={
              <BandChart
                title="Resting heart rate vs personal band"
                series={mockOseiHeartRateSeries}
                unit="/min"
                sourceIds={['SRC_DEMO_BASELINE_ENGINE']}
                events={[{ missionDay: 141, label: 'Scenario start', tone: 'watch' }]}
                height={180}
              />
            }
            about={
              <HowTo
                defaultOpen={false}
                steps={[
                  { text: 'Sit quietly for 20 minutes.', tag: 'demo wording' },
                  { text: 'Measure with the camera or a wearable.', tag: 'demo wording' },
                ]}
              />
            }
            provenance={
              <p className="text-sm text-text-2">
                Simulated observation · quality good ·{' '}
                <Value value={3} unit="h" sourceIds={['SRC_DEMO_SIMULATION']} size="sm" /> old
              </p>
            }
          />
          {mockAssessments.slice(1).map((a) => (
            <SignalCard
              key={`${a.crewId}-${a.signalId}`}
              title={`${LABEL[a.signalId] ?? a.signalId} · ${a.crewId}`}
              verdict={a.verdict}
              value={
                <Value
                  value={a.latest?.value ?? null}
                  unit={a.latest?.unit}
                  sourceIds={a.layers.personal.sourceIds}
                  label={a.latest ? 'SIMULATED' : undefined}
                />
              }
              layers={a.layers}
              drivenBy={a.drivenBy}
              action={
                a.action.text ? (
                  <ActionCard verdict={a.verdict} text={a.action.text} kind={a.action.kind} />
                ) : undefined
              }
              why={<p className="text-sm text-text">{a.explanation}</p>}
            />
          ))}
        </div>
      </Demo>
      <Demo name="Card" note="Surface container; optional status tone accent.">
        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Neutral card" subtitle="MD 143 · simulated">
            <p className="text-sm text-text-2">Elevation by surface colour, not shadows.</p>
          </Card>
          <Card title="Toned card" tone="info" headingLevel={3}>
            <p className="text-sm text-text-2">{mockSleepExpected.explanation}</p>
          </Card>
        </div>
      </Demo>
    </GallerySection>
  );
}
