// Permission explainer (shown BEFORE the camera is requested) and the How-to card (doc 09 §1.4, doc 11 §5.4).
import { Armchair, Camera, Clock, Play, ShieldCheck, Sun, Wind } from 'lucide-react';

import { Button, Card, HowTo } from '../../../ui';
import { HOWTO_STEPS, PRIVACY_LINE } from './copy';

export function PermissionExplainer({ onContinue, onExit }: { onContinue: () => void; onExit?: () => void }) {
  return (
    <Card
      aria-labelledby="cp-explainer"
      title={
        <span id="cp-explainer" className="flex items-center gap-2 text-xl">
          <Camera aria-hidden="true" size={22} /> Camera pulse needs your camera
        </span>
      }
    >
      <p className="max-w-prose text-text-2">
        Each heartbeat changes the colour of your skin very slightly. ARGUS reads this from the forehead and cheeks in
        the camera image and turns it into a pulse rate. The browser will ask for camera permission on the next step.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-text-2">
        <li className="flex items-start gap-2">
          <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-ok" />
          <span>
            <strong className="text-text">{PRIVACY_LINE}</strong> Frames are analysed in memory and dropped right away;
            nothing is recorded, stored or uploaded.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-ok" />
          <span>Works offline. The face tracker runs inside this browser.</span>
        </li>
      </ul>
      <p className="mt-4 max-w-prose text-xs text-text-3">
        This is a wellness estimate from a webcam, not a medical device. Every result comes with a quality rating.
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

const ICONS = { still: Armchair, light: Sun, time: Clock, breathe: Wind } as const;
const STEPS = HOWTO_STEPS.map((s) => ({ text: s.text, icon: ICONS[s.id] }));

export function HowToCard({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  return (
    <Card title="How to measure">
      <HowTo title="Before you start" steps={STEPS} collapsible={false} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" icon={Play} onClick={onStart}>
          Start 30-second measurement
        </Button>
        <Button onClick={onBack}>Back</Button>
      </div>
    </Card>
  );
}
