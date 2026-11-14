// NASA DONKI solar energetic particle event list — unavailable in this build. No invented events.
import { CloudOff, ExternalLink } from 'lucide-react';

import type { DonkiFeed } from '../../services/adapters/donkiSource';
import { DONKI_PAGE } from '../../services/adapters/donkiSource';
import { Card, SourceBadge, buttonClass } from '../../ui';
import { formatUtc } from './format';

export function DonkiCard({ donki }: { donki: DonkiFeed | null }) {
  return (
    <Card
      title="Solar particle events (NASA DONKI)"
      subtitle="Event list · last 30 days"
      actions={<SourceBadge sourceIds={['SRC_DONKI']} title="NASA DONKI SEP events" />}
      data-testid="donki-card"
    >
      <div className="flex flex-col gap-3 text-sm text-text-2">
        <p className="flex items-start gap-2 text-text">
          <CloudOff size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-text-3" />
          The NASA DONKI event list is unavailable in this build.
        </p>
        <p>
          The DONKI service did not answer when this build was made
          {donki?.attemptedAt ? ` (recorded attempt ${formatUtc(donki.attemptedAt)})` : ''}, so no event list
          is shown. An empty list here does not mean that no solar particle events occurred. The S level and
          flux on this screen come from NOAA GOES.
        </p>
        <a
          href={DONKI_PAGE}
          target="_blank"
          rel="noreferrer"
          className={buttonClass('ghost', false, 'self-start px-2')}
        >
          <ExternalLink size={16} aria-hidden="true" />
          Open DONKI (CCMC)
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </Card>
  );
}
