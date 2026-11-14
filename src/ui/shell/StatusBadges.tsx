import { CloudOff, FlaskConical, History, Radio, Database, HardDrive } from 'lucide-react';

import { useOnlineStatus } from '../../state/hooks';
import type { SpaceWeatherMode } from '../../state/ui';
import { Badge } from '../Badge';
import { cx } from '../tone';

/** Persistent honesty badge (docs/PROJECT_RULES.md rule 2, NFR-10): outline, always visible while simulated crew data can be on screen. */
export function SimulatedDataBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      mono
      icon={FlaskConical}
      className={cx('border-dashed', className)}
      data-testid="simulated-badge"
    >
      Simulated data
    </Badge>
  );
}

const SW: Record<SpaceWeatherMode, { icon: typeof Radio; text: string; tone: 'brand' | 'neutral' | 'info' }> =
  {
    LIVE: { icon: Radio, text: 'Live NOAA/NASA space weather', tone: 'brand' },
    CACHED: { icon: Database, text: 'Cached space weather (network unavailable)', tone: 'neutral' },
    SNAPSHOT: { icon: HardDrive, text: 'Space weather from the bundled snapshot', tone: 'neutral' },
    REPLAY: { icon: History, text: 'Replaying a synthetic solar-event profile (demo), not a recorded event', tone: 'info' },
  };

/** Space-weather data mode: LIVE / CACHED / SNAPSHOT / REPLAY (doc 11 §3). Fed by useUiStore.spaceWeatherMode. */
export function SpaceWeatherBadge({ mode, className }: { mode: SpaceWeatherMode; className?: string }) {
  const m = SW[mode];
  return (
    <Badge
      tone={m.tone}
      variant="outline"
      mono
      icon={m.icon}
      className={className}
      title={m.text}
      data-testid="space-weather-badge"
    >
      <span className="sr-only">Space weather: </span>
      {mode}
    </Badge>
  );
}

/** Online / offline dot (navigator.onLine + events). Word + dot, never the dot alone. */
export function OfflineIndicator({ className }: { className?: string }) {
  const online = useOnlineStatus();
  return (
    <span
      role="status"
      title={
        online
          ? 'Online. Core features also work offline.'
          : 'Offline. Core features keep working; space weather uses the cached copy.'
      }
      className={cx(
        'inline-flex h-6 items-center gap-1.5 rounded-pill px-1 font-mono text-[11px] tracking-wider text-text-2 uppercase',
        className,
      )}
      data-testid="online-status"
    >
      {online ? (
        <span aria-hidden="true" className="h-2 w-2 rounded-pill bg-ok" />
      ) : (
        <CloudOff size={13} aria-hidden="true" className="text-watch" />
      )}
      {online ? 'Online' : 'Offline'}
    </span>
  );
}
