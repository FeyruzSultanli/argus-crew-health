// Current NOAA S level (debounced) with the latest ≥10 / ≥100 MeV flux (doc 11 §5.5 row 1).
import {
  DEBOUNCE_POINTS,
  S100_ALERT_PFU,
  S_SCALE_SOURCE_IDS,
  S_SCALE_WORD,
  S_THRESHOLDS_PFU,
} from '../../domain/radiation/sscale';
import type { SpaceWeatherView } from '../../services/spaceWeather';
import { Card, TONE, Value, cx } from '../../ui';
import type { Tone } from '../../ui';
import { dataLabelOf } from './format';
import { ReplayTag } from './ReplayTag';

export interface SScaleTileProps {
  view: SpaceWeatherView;
  freshness?: string;
  /** Tone of the shelter advisory for this profile (colour means status: the policy decides, not the S number). */
  tone?: Tone;
}

export function SScaleTile({ view, freshness, tone }: SScaleTileProps) {
  const { state } = view;
  const p10 = state.protons10[state.protons10.length - 1];
  const p100 = state.protons100[state.protons100.length - 1];
  const srcIds = view.replay ? [...S_SCALE_SOURCE_IDS, ...view.replay.sourceIds] : [...S_SCALE_SOURCE_IDS];
  const label = dataLabelOf(state.mode);
  return (
    <Card
      title="Solar radiation storm"
      subtitle="NOAA S scale on ≥10 MeV flux · debounced"
      data-testid="s-scale-tile"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline gap-3">
          <span
            className={cx(
              'font-mono text-5xl leading-[1.1] font-semibold',
              tone ? TONE[tone].text : 'text-text',
            )}
            data-testid="s-level"
          >
            S{state.sScale}
          </span>
          <span className="text-base text-text-2">{S_SCALE_WORD[state.sScale]}</span>
        </div>
        {view.replay && <ReplayTag synthetic={view.replay.synthetic} />}
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <dt className="text-text-2">≥10 MeV</dt>
          <dd>
            <Value
              value={p10?.fluxPfu ?? null}
              unit="pfu"
              precision={p10 && p10.fluxPfu < 10 ? 2 : 1}
              sourceIds={srcIds}
              label={label}
              freshness={freshness}
              title="≥10 MeV integral proton flux"
            />
          </dd>
          <dt className="text-text-2">≥100 MeV</dt>
          <dd>
            <Value
              value={p100?.fluxPfu ?? null}
              unit="pfu"
              precision={2}
              sourceIds={srcIds}
              label={label}
              title="≥100 MeV integral proton flux"
            />
          </dd>
          <dt className="text-text-2">≥100 MeV alert</dt>
          <dd
            className={cx('text-sm', state.s100Alert ? TONE.act.text : 'text-text-2')}
            data-testid="s100-alert"
          >
            {state.s100Alert ? 'On (latest ' : 'Off (latest '}
            <Value
              value={DEBOUNCE_POINTS}
              sourceIds={S_SCALE_SOURCE_IDS}
              size="sm"
              interactive={false}
            />{' '}
            samples {state.s100Alert ? 'all ≥' : 'not all ≥'}{' '}
            <Value
              value={S100_ALERT_PFU}
              unit="pfu"
              sourceIds={S_SCALE_SOURCE_IDS}
              size="sm"
              interactive={false}
            />
            )
          </dd>
        </dl>
        <details className="text-xs text-text-2">
          <summary className="inline-flex min-h-target cursor-pointer items-center rounded-control">
            S-scale thresholds (≥10 MeV)
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {S_THRESHOLDS_PFU.map((t, i) => (
              <li key={t} className="flex items-center gap-2">
                <span className="w-6 font-mono">S{i + 1}</span>
                <Value value={t} unit="pfu" prefix="≥" sourceIds={S_SCALE_SOURCE_IDS} size="sm" />
              </li>
            ))}
          </ul>
        </details>
      </div>
    </Card>
  );
}
