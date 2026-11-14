import { mockFlagDensity } from '../../../test/fixtures';
import { useMissionStore } from '../../../state/mission';
import { missionDayText } from '../../../state/missionSelectors';
import type { SpaceWeatherMode } from '../../../state/ui';
import { useToast } from '../../../ui/toastContext';
import { MissionChip } from '../../../ui/shell/MissionChip';
import { MissionScrubber } from '../../../ui/shell/MissionScrubber';
import { OfflineIndicator, SimulatedDataBadge, SpaceWeatherBadge } from '../../../ui/shell/StatusBadges';
import { Demo, GallerySection } from './GallerySection';

const MODES: readonly SpaceWeatherMode[] = ['LIVE', 'CACHED', 'SNAPSHOT', 'REPLAY'];

export function ShellSection() {
  const missionDay = useMissionStore((s) => s.missionDay);
  const toast = useToast();
  return (
    <GallerySection id="shell" title="Shell">
      <Demo name="Badges" note="SIMULATED DATA (always in the shell), space-weather mode, online/offline.">
        <div className="flex flex-wrap items-center gap-2">
          <SimulatedDataBadge />
          {MODES.map((m) => (
            <SpaceWeatherBadge key={m} mode={m} />
          ))}
          <OfflineIndicator />
        </div>
      </Demo>
      <Demo name="MissionChip" note="Opens the profile picker; delay is live for the current mission day.">
        <MissionChip />
      </Demo>
      <Demo
        name="MissionScrubber"
        note="Mock flag density from scenario days. Drag, or focus and use ←/→, Shift+←/→, Home/End."
      >
        <div className="overflow-hidden rounded-card border border-border">
          <MissionScrubber
            density={mockFlagDensity}
            onReplay={() => toast.show({ title: 'Replay placeholder' })}
          />
        </div>
        <p className="mt-2 font-mono text-xs text-text-2" data-testid="dev-mission-day">
          useMissionStore.missionDay = {missionDay} ({missionDayText(missionDay)})
        </p>
      </Demo>
    </GallerySection>
  );
}
