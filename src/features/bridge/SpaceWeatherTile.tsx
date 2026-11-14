import { Satellite, TriangleAlert } from 'lucide-react';

import type { SpaceWeatherState } from '../../domain/types';
import { useUiStore } from '../../state/ui';
import { Badge, Card, LinkButton, Sparkline, Value } from '../../ui';
import type { DataLabel } from '../../ui';

export interface SpaceWeatherTileProps {
  /**
   * Space-weather state from the space-weather service. Until it is passed the tile is an honest
   * placeholder: no numbers, only the shell's current mode badge.
   */
  state?: SpaceWeatherState;
}

const NOAA = ['SRC_NOAA_SWPC_PROTONS'];

const LABEL: Partial<Record<SpaceWeatherState['mode'], DataLabel>> = { LIVE: 'LIVE', REPLAY: 'REPLAY' };

function ModeBadge({ mode }: { mode: SpaceWeatherState['mode'] }) {
  return (
    <Badge variant="outline" mono tone={mode === 'LIVE' ? 'brand' : 'neutral'}>
      <span className="sr-only">Space weather mode: </span>
      {mode}
    </Badge>
  );
}

/** Space weather tile (doc 11 §5.1): S-level, ≥10 MeV flux sparkline, mode badge, ≥100 MeV alert. */
export function SpaceWeatherTile({ state }: SpaceWeatherTileProps) {
  const shellMode = useUiStore((s) => s.spaceWeatherMode);
  const mode = state?.mode ?? shellMode;
  const latest = state?.protons10[state.protons10.length - 1];
  // Replayed numbers come from the synthetic demo profile, so they also cite the demo radiation model.
  const ids = state?.mode === 'REPLAY' ? [...NOAA, 'SRC_DEMO_RADIATION_MODEL'] : NOAA;
  return (
    <Card
      title="Space weather"
      subtitle="Solar protons · NOAA SWPC"
      actions={<ModeBadge mode={mode} />}
      data-testid="space-weather-tile"
    >
      {!state ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-sm text-text-2">
            <Satellite size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-text-3" />
            <span>
              Space weather feed connects here: proton flux, S-scale and shelter advisories arrive with the
              radiation module.
            </span>
          </p>
          <div>
            <LinkButton to="/environment" variant="ghost">
              Open radiation &amp; cabin
            </LinkButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-xs text-text-2">NOAA S-scale</span>
              <Value
                value={state.sScale}
                prefix="S"
                sourceIds={ids}
                size="lg"
                label={LABEL[state.mode]}
                title="NOAA S-scale"
              />
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-text-2">≥10 MeV protons, latest</span>
              <Value
                value={latest?.fluxPfu ?? null}
                unit="pfu"
                precision={2}
                sourceIds={ids}
                size="sm"
                label={LABEL[state.mode]}
                title="≥10 MeV proton flux"
              />
            </span>
          </div>
          <Sparkline
            ariaLabel="≥10 MeV proton flux"
            width={260}
            height={36}
            points={state.protons10.map((p, i) => ({ missionDay: i, value: p.fluxPfu }))}
          />
          {state.s100Alert && (
            <p role="status" className="flex items-center gap-2 text-sm text-watch-fg">
              <TriangleAlert size={16} aria-hidden="true" className="text-watch" />
              ≥100 MeV proton alert active
            </p>
          )}
          <div>
            <LinkButton to="/environment" variant="ghost">
              Open radiation &amp; cabin
            </LinkButton>
          </div>
        </div>
      )}
    </Card>
  );
}
