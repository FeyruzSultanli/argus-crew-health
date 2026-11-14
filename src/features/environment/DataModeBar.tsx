// Data mode badge + "fetched 4 min ago" + source links (doc 11 §5.5, doc 10 §7).
import { ExternalLink } from 'lucide-react';

import { NOAA_PRODUCT_PAGE, noaaUrl } from '../../services/adapters/noaaSource';
import type { SpaceWeatherView } from '../../services/spaceWeather';
import { SpaceWeatherBadge, buttonClass, formatAge } from '../../ui';
import { formatUtc } from './format';

function freshnessText(view: SpaceWeatherView, now: number): string {
  const { state } = view;
  const raw = state.fetchedAt ? formatAge(Math.max(0, (now - Date.parse(state.fetchedAt)) / 60_000)) : null;
  const age = raw === 'now' ? 'under 1 min' : raw;
  switch (state.mode) {
    case 'LIVE':
      return raw === 'now'
        ? 'Live NOAA GOES feed · fetched just now'
        : `Live NOAA GOES feed · fetched ${age} ago`;
    case 'CACHED':
      return `Cached copy · ${age} old (fetched ${state.fetchedAt ? formatUtc(state.fetchedAt) : '—'})${
        view.liveError ? ` · live feed unavailable: ${view.liveError}` : ''
      }`;
    case 'SNAPSHOT':
      return `Bundled snapshot · captured ${view.capturedAt ? formatUtc(view.capturedAt) : '—'} (${age} old)${
        view.liveError ? ` · live feed unavailable: ${view.liveError}` : ''
      }`;
    case 'REPLAY':
      return `${view.replay?.label ?? 'REPLAY'} · live feed hidden on this screen while the replay runs`;
  }
}

const LINKS = [
  { href: NOAA_PRODUCT_PAGE, label: 'NOAA SWPC GOES proton flux' },
  { href: noaaUrl('1-day'), label: 'NOAA JSON (1 day)' },
];

export function DataModeBar({ view, now }: { view: SpaceWeatherView | undefined; now: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="data-mode-bar">
      {view ? (
        <>
          <SpaceWeatherBadge mode={view.state.mode} />
          <span className="text-xs text-text-2" data-testid="data-freshness">
            {freshnessText(view, now)}
          </span>
        </>
      ) : (
        <span className="text-xs text-text-2">Loading space weather…</span>
      )}
      <span className="flex flex-wrap items-center">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('ghost', false, 'px-2 text-xs')}
          >
            <ExternalLink size={14} aria-hidden="true" />
            {l.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ))}
      </span>
    </div>
  );
}
