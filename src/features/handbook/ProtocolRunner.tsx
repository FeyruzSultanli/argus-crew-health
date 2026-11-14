// Protocol runner (FR-HELP-3, doc 07 §5, doc 11 §5.8): one big step card at a time, "Next" with Space/Enter, Back,
// progress, step source tags, timers that never block, the final "send report to the flight surgeon" step, and a
// run record on finish. Step text comes verbatim from seed/protocols.json — nothing is added.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Send } from 'lucide-react';

import type { Protocol } from './content';
import { useMissionStore } from '../../state/mission';
import { Badge, Button, Card, KeyHint, LinkButton } from '../../ui';
import { StepTag } from './StepTag';
import { StepTimer } from './StepTimer';
import { TriggerStatus } from './TriggerStatus';
import { saveProtocolRun } from './protocolRuns';
import type { ProtocolRunRecord } from './protocolRuns';
import { useSubjectCrewId } from './useHandbook';

const INTERACTIVE =
  'button, a, input, textarea, select, summary, [role="radio"], [role="switch"], [role="tab"]';

/** Space / Enter advance unless focus is on a control (which handles the key itself). */
function isFromControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}

export interface ProtocolRunnerProps {
  protocol: Protocol;
  /** Injectable clock (tests). */
  now?: () => number;
}

export function ProtocolRunner({ protocol, now = Date.now }: ProtocolRunnerProps) {
  const crewId = useSubjectCrewId();
  const missionDay = useMissionStore((s) => s.missionDay);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState<ProtocolRunRecord | null>(null);
  const run = useRef<{ startedAt: string; steps: ProtocolRunRecord['steps'] }>({
    startedAt: new Date(now()).toISOString(),
    steps: [{ stepId: protocol.steps[0]?.id ?? 's1', at: new Date(now()).toISOString() }],
  });
  const cardRef = useRef<HTMLHeadingElement>(null);
  const steps = protocol.steps;
  const step = steps[index];
  const last = index === steps.length - 1;

  const goTo = useCallback(
    (i: number) => {
      const s = steps[i];
      if (!s) return;
      run.current.steps.push({ stepId: s.id, at: new Date(now()).toISOString() });
      setIndex(i);
    },
    [steps, now],
  );

  const finish = useCallback(() => {
    const record: ProtocolRunRecord = {
      protocolId: protocol.id,
      crewId,
      missionDay,
      startedAt: run.current.startedAt,
      finishedAt: new Date(now()).toISOString(),
      steps: [...run.current.steps],
    };
    saveProtocolRun(record);
    setFinished(record);
  }, [protocol.id, crewId, missionDay, now]);

  const next = useCallback(() => (last ? finish() : goTo(index + 1)), [last, finish, goTo, index]);

  const restart = () => {
    const at = new Date(now()).toISOString();
    run.current = { startedAt: at, steps: [{ stepId: steps[0]?.id ?? 's1', at }] };
    setFinished(null);
    setIndex(0);
  };

  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isFromControl(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return; // a source drawer is open
      e.preventDefault();
      next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, finished]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index, finished]);

  if (finished) {
    return (
      <Card title="Protocol complete" data-testid="protocol-complete">
        <h2 ref={cardRef} tabIndex={-1} className="sr-only">
          {protocol.title}: complete
        </h2>
        <p className="text-sm text-text-2">The run record is saved on this device.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton to={sendHref(crewId)} variant="primary" icon={Send}>
            Send report to flight surgeon
          </LinkButton>
          <Button icon={RotateCcw} onClick={restart}>
            Run again
          </Button>
          <LinkButton to="/handbook?category=protocols" icon={ArrowLeft}>
            All protocols
          </LinkButton>
        </div>
      </Card>
    );
  }
  if (!step) return null;

  return (
    <div className="flex flex-col gap-6">
      <TriggerStatus protocol={protocol} crewId={crewId} />
      <div
        role="progressbar"
        aria-label="Protocol progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
        aria-valuetext={`Step ${index + 1} of ${steps.length}`}
        className="flex gap-1"
      >
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 flex-1 rounded-pill ${i <= index ? 'bg-brand' : 'bg-surface-2'}`}
          />
        ))}
      </div>
      <Card className="flex min-h-72 flex-col gap-5 p-6" data-testid="protocol-step" data-step={step.id}>
        <p className="font-mono text-xs tracking-wider text-text-2 uppercase" data-testid="step-counter">
          Step {index + 1} of {steps.length}
        </p>
        <h2
          ref={cardRef}
          tabIndex={-1}
          className="text-2xl leading-snug font-semibold text-text outline-none"
        >
          {step.text}
        </h2>
        <StepTag step={step} />
        {step.timerSec !== undefined && (
          <StepTimer
            key={step.id}
            timerSec={step.timerSec}
            sourceIds={step.sourceIds}
            label={step.text}
            now={now}
          />
        )}
        {step.kind === 'send-to-surgeon' && (
          <div>
            <LinkButton to={sendHref(crewId)} variant="primary" icon={Send}>
              Send report to flight surgeon
            </LinkButton>
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button icon={ArrowLeft} onClick={() => goTo(index - 1)} disabled={index === 0}>
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <KeyHint keys={['Space']} label="or Enter" />
            <Button variant={last ? 'secondary' : 'primary'} icon={last ? Check : ArrowRight} onClick={next}>
              {last ? 'Finish protocol' : step.timerSec !== undefined ? 'Continue without waiting' : 'Next'}
            </Button>
          </div>
        </div>
      </Card>
      {protocol.steps.some((s) => s.tag === 'demo wording') && (
        <p className="text-xs text-text-3">
          <Badge variant="outline" mono>
            Demo wording
          </Badge>{' '}
          marks our own step wording, from the ARGUS clinical rules, without a published source.
        </p>
      )}
    </div>
  );
}

function sendHref(crewId: string | null): string {
  return crewId ? `/earth?crew=${encodeURIComponent(crewId)}&flags=1` : '/earth?flags=1';
}
