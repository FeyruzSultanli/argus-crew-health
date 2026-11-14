import { Armchair, Camera, Inbox, Timer } from 'lucide-react';

import { Button } from '../../../ui/Button';
import { HowTo } from '../../../ui/HowTo';
import { KeyHint } from '../../../ui/KeyHint';
import { EmptyState, ErrorState, Skeleton } from '../../../ui/States';
import { useToast } from '../../../ui/toastContext';
import { VERDICT } from '../../../ui/tone';
import type { Tone } from '../../../ui/tone';
import { Demo, GallerySection } from './GallerySection';

const TOASTS: ReadonlyArray<{ tone: Tone; title: string }> = [
  { tone: 'ok', title: 'Measurement saved' },
  { tone: 'info', title: 'Packet delivered' },
  { tone: 'watch', title: 'Reading quality is poor. Re-measure.' },
  { tone: 'act', title: 'Shelter advisory' },
  { tone: 'muted', title: 'Offline: using cached space weather' },
];

export function StatesSection() {
  const toast = useToast();
  return (
    <GallerySection id="states" title="States & feedback">
      <Demo name="HowTo" note="Numbered steps with icons; collapsible. Wording tags per docs/PROJECT_RULES.md rule 3.">
        <HowTo
          title="How to measure (camera pulse)"
          steps={[
            { text: 'Sit still in even light, face the camera.', icon: Armchair, tag: 'demo wording' },
            { text: 'Keep your face inside the frame.', icon: Camera, tag: 'demo wording' },
            { text: 'Hold for the capture countdown.', icon: Timer, tag: 'demo wording' },
          ]}
        />
      </Demo>
      <Demo name="EmptyState / Skeleton / ErrorState">
        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState
            icon={Inbox}
            title="No messages yet"
            body="Replies from the flight surgeon appear here."
            action={<Button>Compose packet</Button>}
          />
          <div className="rounded-card border border-border p-5">
            <Skeleton label="Loading signals" />
            <Skeleton variant="block" className="mt-4" label="Loading chart" />
          </div>
          <ErrorState
            message="Space weather could not be fetched. Showing the cached copy."
            onRetry={() => toast.show({ title: 'Retrying…' })}
            detail="NetworkError: offline"
          />
        </div>
      </Demo>
      <Demo name="Toast" note="Bottom-right, 4 s, status-coloured left border.">
        <div className="flex flex-wrap gap-2">
          {TOASTS.map((t) => (
            <Button key={t.tone} onClick={() => toast.show({ tone: t.tone, title: t.title })}>
              {t.tone === 'muted'
                ? 'Neutral'
                : VERDICT[
                    t.tone === 'ok'
                      ? 'NOMINAL'
                      : t.tone === 'info'
                        ? 'EXPECTED'
                        : t.tone === 'watch'
                          ? 'WATCH'
                          : 'ACT'
                  ].word}{' '}
              toast
            </Button>
          ))}
        </div>
      </Demo>
      <Demo name="KeyHint">
        <div className="flex flex-wrap gap-6">
          <KeyHint keys={['←', '→']} label="One day" />
          <KeyHint keys={['Shift', '→']} label="One week" />
          <KeyHint keys={['Space']} label="Respond (reaction test)" />
          <KeyHint keys={['Esc']} label="Close" />
        </div>
      </Demo>
    </GallerySection>
  );
}
