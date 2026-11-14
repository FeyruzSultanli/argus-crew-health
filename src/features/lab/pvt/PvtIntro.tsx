// Reaction Self-Test how-to card (doc 09 intro: ≤ 5 steps, icon per step) with the practice and device notes.
import { Keyboard, MonitorSmartphone, Pause, Play, Square, Timer, Zap } from 'lucide-react';

import { PVT_DEMO_SOURCE_ID, PVT_PARAMS } from '../../../measurement/pvt';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { HowTo } from '../../../ui/HowTo';
import type { HowToStep } from '../../../ui/HowTo';
import { Value } from '../../../ui/Value';
import { TestModeBadge } from './bits';
import type { PvtTestMode } from './testMode';

// Procedure wording for the test itself (our own, not clinical advice) — tagged "demo wording".
const STEPS: readonly HowToStep[] = [
  { icon: Timer, text: 'Stay on this screen until the test ends.', tag: 'demo wording' },
  { icon: Square, text: 'A red box with a counting number appears at random moments.', tag: 'demo wording' },
  { icon: Keyboard, text: 'Press Space (or any key), or tap the big button, as soon as it appears.', tag: 'demo wording' },
  { icon: Zap, text: 'A press before the box appears counts as a false start.', tag: 'demo wording' },
  { icon: Pause, text: 'Leaving the tab or window pauses the test; staying away too long stops it.', tag: 'demo wording' },
];

export interface PvtIntroProps {
  isPractice: boolean;
  testMode: PvtTestMode | null;
  onStart: () => void;
  onExit?: () => void;
}

export function PvtIntro({ isPractice, testMode, onStart, onExit }: PvtIntroProps) {
  return (
    <Card title="Before you start" actions={testMode ? <TestModeBadge profile={testMode.profile} /> : undefined}>
      <HowTo steps={STEPS} collapsible={false} />
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-text-2">
        <div className="flex items-center gap-2">
          <dt>Duration</dt>
          <dd>
            <Value value={PVT_PARAMS.durationMs / 60000} unit="min" sourceIds={['SRC_PVT_B_BASNER2011']} title="Test duration" />
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>Away longer than this stops the test</dt>
          <dd>
            <Value value={PVT_PARAMS.focusLossAbortMs / 1000} unit="s" sourceIds={[PVT_DEMO_SOURCE_ID]} title="Focus-loss limit" />
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-col gap-2 text-sm">
        <p className="flex items-start gap-2 text-text-2">
          <MonitorSmartphone aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-info" />
          <span>
            <strong className="text-text">Use the same device for comparable results.</strong> Device latency differs
            between machines, and personal baselines compare like with like.
          </span>
        </p>
        <p className="rounded-control border border-info-border bg-info-bg p-3 text-text" data-testid="pvt-practice-notice">
          {isPractice
            ? 'This is your first Reaction Self-Test: the result is labeled "practice".'
            : 'A first-ever run is labeled "practice"; this run counts as a regular test.'}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" icon={Play} onClick={onStart}>
          Start 3-minute test
        </Button>
        {onExit && <Button onClick={onExit}>Not now</Button>}
      </div>
    </Card>
  );
}
