// Modeled SPE dose of the current / most recent event vs the 250 mSv design limit (doc 10 §4–§5, doc 11 §5.5).
// Illustrative model only; every number here is a demo parameter and says so.
import { SPE_LIMIT_MSV } from '../../domain/radiation/doseLedger';
import {
  MODELED_LABEL,
  SHIELD_FACTOR_NORMAL,
  SHIELD_FACTOR_SHELTER,
  SPE_K_MSV_PER_H_PER_PFU,
  speDoseRateMsvPerH,
} from '../../domain/radiation/speDose';
import type { SpaceWeatherView } from '../../services/spaceWeather';
import { Card, Value } from '../../ui';
import { dataLabelOf } from './format';
import { ReplayTag } from './ReplayTag';

const MODEL = ['SRC_DEMO_RADIATION_MODEL'];

export function SpeMeter({ view }: { view: SpaceWeatherView }) {
  const { spe, state, replay } = view;
  const msv = spe.currentEventMsv;
  const pct = (msv / SPE_LIMIT_MSV) * 100;
  const flux100 = state.protons100[state.protons100.length - 1]?.fluxPfu ?? 0;
  const rate = spe.active ? speDoseRateMsvPerH(flux100) : 0;
  const label = dataLabelOf(state.mode);
  return (
    <Card
      title="Solar-event dose (modeled)"
      subtitle="Current or most recent event vs the SPE design limit (NASA-STD-3001)"
      data-testid="spe-meter"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-watch-fg" data-testid="modeled-label">
          {MODELED_LABEL}
        </p>
        {replay && <ReplayTag synthetic={replay.synthetic} />}
        <div className="flex flex-wrap items-baseline gap-x-3" data-testid="spe-event-dose">
          <Value
            value={msv}
            unit="mSv"
            precision={2}
            sourceIds={MODEL}
            label={label}
            size="lg"
            title="Modeled dose of this event"
          />
          <Value
            value={pct}
            unit="%"
            precision={2}
            sourceIds={[...MODEL, 'SRC_STD3001_RAD']}
            size="sm"
            title="Share of the 250 mSv SPE design limit"
          />
        </div>
        <div className="relative h-3 rounded-pill bg-surface-2" aria-hidden="true">
          <div
            className="h-full min-w-[3px] rounded-pill bg-text"
            style={{ width: `${Math.min(100, pct)}%`, display: msv > 0 ? undefined : 'none' }}
          />
          <div className="absolute inset-y-[-3px] left-1/2 w-0.5 bg-act" />
        </div>
        <div className="flex justify-between text-xs text-text-3">
          <Value value={0} unit="mSv" sourceIds={['SRC_STD3001_RAD']} size="sm" interactive={false} />
          <span className="inline-flex items-center gap-1">
            Act at{' '}
            <Value
              value={SPE_LIMIT_MSV / 2}
              unit="mSv"
              sourceIds={[...MODEL, 'SRC_STD3001_RAD']}
              size="sm"
              interactive={false}
            />
          </span>
          <span className="inline-flex items-center gap-1">
            Design limit
            <Value
              value={SPE_LIMIT_MSV}
              unit="mSv"
              sourceIds={['SRC_STD3001_RAD']}
              size="sm"
              interactive={false}
            />
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-text-2">
          <dt>Event</dt>
          <dd className="text-text">
            {spe.active
              ? 'Active (debounced S1+ or ≥100 MeV alert)'
              : msv > 0
                ? 'Ended'
                : 'No event in the data on screen'}
          </dd>
          <dt>Dose rate now</dt>
          <dd>
            <Value
              value={rate}
              unit="mSv/h"
              precision={3}
              sourceIds={MODEL}
              label={label}
              size="sm"
              title="Modeled dose rate"
            />
          </dd>
          <dt>Model</dt>
          <dd>
            rate ={' '}
            <Value
              value={SPE_K_MSV_PER_H_PER_PFU}
              sourceIds={MODEL}
              precision={2}
              size="sm"
              interactive={false}
            />{' '}
            × ≥100 MeV flux × shield factor{' '}
            <Value
              value={SHIELD_FACTOR_NORMAL}
              sourceIds={MODEL}
              precision={1}
              size="sm"
              interactive={false}
            />{' '}
            (normal quarters;{' '}
            <Value
              value={SHIELD_FACTOR_SHELTER}
              sourceIds={MODEL}
              precision={1}
              size="sm"
              interactive={false}
            />{' '}
            in the storm shelter). Only while an event is active.
          </dd>
        </dl>
      </div>
    </Card>
  );
}
