// The label every replayed number or banner carries (doc 10 §8): REPLAY + "synthetic S2-class profile (demo), not a
// recorded event". Never "real", never "live".
import { History } from 'lucide-react';

import { SYNTHETIC_REPLAY_WORDS } from '../../domain/radiation/replay';
import { Badge } from '../../ui';

export function ReplayTag({ synthetic = true, compact = false }: { synthetic?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="replay-tag">
      <Badge tone="info" variant="outline" mono icon={History}>
        REPLAY
      </Badge>
      {!compact && (
        <span className="text-xs text-text-2">
          — {synthetic ? SYNTHETIC_REPLAY_WORDS : 'recorded NOAA GOES window'}
        </span>
      )}
      {compact && <span className="sr-only">{SYNTHETIC_REPLAY_WORDS}</span>}
    </span>
  );
}
