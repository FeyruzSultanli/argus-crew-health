// Shelter advisory banner (doc 11 §5.5 top, doc 10 §6). Environment-level, demo policy — never a crew verdict.
import { Info, ShieldAlert, ShieldQuestion } from 'lucide-react';

import type { ShelterAdvisory } from '../../domain/radiation/shelter';
import type { SpaceWeatherView } from '../../services/spaceWeather';
import { Badge, SourceBadge, TONE, cx } from '../../ui';
import type { Tone } from '../../ui';
import { formatDuration } from './format';
import { ReplayTag } from './ReplayTag';

const LEVEL: Record<ShelterAdvisory['level'], { tone: Tone; icon: typeof Info; word: string }> = {
  ACT: { tone: 'act', icon: ShieldAlert, word: 'Act' },
  WATCH: { tone: 'watch', icon: ShieldQuestion, word: 'Watch' },
  info: { tone: 'info', icon: Info, word: 'Information' },
};

export interface ShelterBannerProps {
  advisory: ShelterAdvisory;
  view: SpaceWeatherView;
  /** Current time of the data on screen (replay event time while replaying), epoch ms. */
  nowMs: number;
}

export function ShelterBanner({ advisory, view, nowMs }: ShelterBannerProps) {
  const m = LEVEL[advisory.level];
  const t = TONE[m.tone];
  const Icon = m.icon;
  const onset = view.onsetTag ? Date.parse(view.onsetTag) : null;
  const replay = view.state.mode === 'REPLAY';
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Shelter advisory"
      data-testid="shelter-banner"
      className={cx('flex flex-col gap-2 rounded-card border border-l-4 p-4', t.bg, t.border, t.accent)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Icon size={22} aria-hidden="true" className={t.icon} />
        <span className={cx('font-mono text-xs tracking-wider uppercase', t.text)}>
          Shelter advisory · {m.word} · S{advisory.sScale}
          {advisory.s100Alert ? ' + ≥100 MeV alert' : ''}
        </span>
        <Badge variant="outline" mono className="border-dashed">
          Demo policy
        </Badge>
        {replay && <ReplayTag synthetic={view.replay?.synthetic ?? true} />}
      </div>
      <p className="text-xl font-semibold text-text" data-testid="shelter-text">
        {advisory.text}
      </p>
      <p className="text-sm text-text-2">{advisory.closing}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-text-2">
        {onset !== null && (
          <span>
            {formatDuration(nowMs - onset)} since event onset{replay ? ' (replay event time)' : ''}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          Policy and S levels{' '}
          <SourceBadge sourceIds={advisory.sourceIds} title="Shelter advisory (demo policy)" />
        </span>
      </div>
    </section>
  );
}
