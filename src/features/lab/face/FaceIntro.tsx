// Permission explainer (BEFORE the camera is requested) and the how-to card of the face scan (docs/09 §2).
import type { ReactNode } from 'react';
import { Clock, FlaskConical, Play, ScanFace, ShieldCheck, Smile, Sun } from 'lucide-react';

import { Badge, Button, Card, HowTo, SourceBadge } from '../../../ui';
import { EXPERIMENTAL, HOWTO_STEPS, NO_IMAGE_LINE, PRIVACY_LINE, REFERENCE_EXPLAINER } from './copy';

export function ExperimentalBadge() {
  return (
    <Badge tone="watch" icon={FlaskConical} className="h-8 text-sm">
      {EXPERIMENTAL}
    </Badge>
  );
}

export function FacePermissionExplainer({ onContinue, onExit }: { onContinue: () => void; onExit?: () => void }) {
  return (
    <Card
      aria-labelledby="fs-explainer"
      title={
        <span id="fs-explainer" className="flex items-center gap-2 text-xl">
          <ScanFace aria-hidden="true" size={22} /> The face scan needs your camera
        </span>
      }
      actions={<ExperimentalBadge />}
    >
      <p className="max-w-prose text-text-2">
        Weightlessness shifts body fluid toward the head{' '}
        <SourceBadge sourceIds={['SRC_NASA_RISKS']} title="NASA human research risks" />. This scan measures the width of
        your cheeks and jaw and the opening of your eyes in the camera image, relative to the distance between your
        pupils, and compares them with your own reference scan. It is a measurement of facial geometry, not a health
        statement. The browser will ask for camera permission on the next step.
      </p>
      <p className="mt-3 max-w-prose text-sm text-text-2">{REFERENCE_EXPLAINER}</p>
      <ul className="mt-4 space-y-2 text-sm text-text-2">
        <li className="flex items-start gap-2">
          <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-ok" />
          <span>
            <strong className="text-text">{PRIVACY_LINE}</strong> {NO_IMAGE_LINE} Frames are analysed in memory and
            dropped right away; nothing is recorded or uploaded.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-ok" />
          <span>Works offline. The face tracker runs inside this browser.</span>
        </li>
      </ul>
      <p className="mt-4 max-w-prose text-xs text-text-3">
        No validated threshold exists for this index. It is shown as a trend only and is not a medical device.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={onContinue}>
          Continue
        </Button>
        {onExit && <Button onClick={onExit}>Not now</Button>}
      </div>
    </Card>
  );
}

const ICONS = { distance: ScanFace, light: Sun, neutral: Smile, still: Clock } as const;
const STEPS = HOWTO_STEPS.map((s) => ({ text: s.text, icon: ICONS[s.id] }));

export function FaceHowTo({ onStart, onBack, children }: { onStart: () => void; onBack: () => void; children?: ReactNode }) {
  return (
    <Card title="How to scan">
      <HowTo title="Before you start" steps={STEPS} collapsible={false} />
      {children}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" icon={Play} onClick={onStart}>
          Start 3-second scan
        </Button>
        <Button onClick={onBack}>Back</Button>
      </div>
    </Card>
  );
}
