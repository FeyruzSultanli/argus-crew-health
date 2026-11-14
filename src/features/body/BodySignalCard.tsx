import { forwardRef } from 'react';

import { getSignal } from '../../domain/signals';
import type { Assessment } from '../../domain/types';
import { actionFor } from '../../domain/verdict';
import { useMissionStore } from '../../state/mission';
import { ActionCard } from '../../ui/ActionCard';
import { LAYER_NAME } from '../../ui/layers';
import { LayerTriad } from '../../ui/LayerTriad';
import { SignalCard } from '../../ui/SignalCard';
import { Sparkline } from '../../ui/Sparkline';
import { VERDICT } from '../../ui/tone';
import { usePersonalSeries } from './bodyData';
import { LatestValue } from './LatestValue';
import { SignalAbout } from './SignalAbout';
import { SignalProvenance } from './SignalProvenance';
import { SignalTrend } from './SignalTrend';
import { actionPrimary, trendWindow } from './cardHelpers';

export interface BodySignalCardProps {
  assessment: Assessment;
  expanded: boolean;
  onToggle: (next: boolean) => void;
}

/** One signal on the right panel: collapsed summary; expanded detail in FR-SIG-4 order. */
export const BodySignalCard = forwardRef<HTMLDivElement, BodySignalCardProps>(function BodySignalCard(
  { assessment: a, expanded, onToggle },
  ref,
) {
  const def = getSignal(a.signalId);
  const missionDay = useMissionStore((s) => s.missionDay);
  const subject = typeof a.crewId === 'string' && a.crewId !== 'cabin' ? a.crewId : null;
  const series = usePersonalSeries(subject ?? 'cabin', a.signalId, missionDay);
  const window = series ? trendWindow(series, missionDay) : [];
  // The action text is the assessment's own (doc 07 templates); an empty text falls back to the domain template.
  const actionText = a.action.text || actionFor(def, a.verdict).text;
  const driving = a.drivenBy.map((l) => `${LAYER_NAME[l].long} (${VERDICT[a.layers[l].verdict].word})`);

  return (
    <div
      ref={ref}
      data-signal={a.signalId}
      // The 420 px panel is too narrow for title + value + triad + sparkline on one row: the toggle takes row one.
      className="[&>article>div:first-child>button]:basis-full"
    >
      <SignalCard
        title={def.label}
        verdict={a.verdict}
        expanded={expanded}
        onToggle={onToggle}
        value={<LatestValue assessment={a} size="sm" />}
        layers={a.layers}
        drivenBy={a.drivenBy}
        caughtOnlyByPersonal={a.caughtOnlyByPersonal}
        sparkline={
          window.length > 1 ? (
            <Sparkline
              points={window}
              width={88}
              ariaLabel={`${def.label}, last ${window.length} readings against your personal band`}
            />
          ) : undefined
        }
        action={
          <ActionCard
            verdict={a.verdict}
            text={actionText}
            kind={a.action.kind}
            dueInHours={a.action.dueInHours}
            sourceIds={a.drivenBy.flatMap((l) => a.layers[l].sourceIds)}
            primary={actionPrimary(a.action)}
            wordingTag="demo wording"
          />
        }
        why={
          <div className="flex flex-col gap-1.5 text-sm">
            <p className="text-text">{a.explanation}</p>
            <p className="text-text-2">
              {driving.length > 0
                ? `Driving layer: ${driving.join(', ')}.`
                : 'No layer has a reading to judge.'}
            </p>
          </div>
        }
        layerDetail={
          <LayerTriad
            className="[&_ul]:grid-cols-1"
            variant="expanded"
            layers={a.layers}
            drivenBy={a.drivenBy}
            caughtOnlyByPersonal={a.caughtOnlyByPersonal}
          />
        }
        chart={
          <SignalTrend
            def={def}
            series={series}
            missionDay={missionDay}
            unit={a.latest?.unit}
            personalSourceIds={a.layers.personal.sourceIds}
          />
        }
        about={<SignalAbout def={def} />}
        provenance={<SignalProvenance assessment={a} def={def} />}
      />
    </div>
  );
});
