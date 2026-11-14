import { useSpaceWeatherView } from '../../services/hooks';
import { SpaceWeatherTile } from './SpaceWeatherTile';

/**
 * Bridge space-weather tile fed by the radiation service (live → cached → snapshot, or the SPE replay).
 * While a replay runs, the tile carries the replay's own label so the synthetic profile is never mistaken for
 * a recorded or live event (doc 10 §8).
 */
export function SpaceWeatherTileConnected() {
  const view = useSpaceWeatherView();
  const replayLabel = view?.state.mode === 'REPLAY' ? view.replay?.label : undefined;
  return (
    <div>
      <SpaceWeatherTile state={view?.state} />
      {replayLabel ? (
        <p className="mt-2 text-xs text-text-2" data-testid="bridge-replay-label">
          {replayLabel}
        </p>
      ) : null}
    </div>
  );
}
