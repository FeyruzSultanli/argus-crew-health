import { NavLink } from 'react-router';
import { BookOpenText, Crosshair } from 'lucide-react';

import { brand } from '../../config/brand';
import { navItemsFor } from '../../config/navigation';
import { useSessionStore } from '../../state/session';
import { useUiStore } from '../../state/ui';
import { BrandMark } from '../BrandMark';
import { LinkButton } from '../Button';
import { cx } from '../tone';
import { MissionChip } from './MissionChip';
import { OfflinePackage } from './OfflinePackage';
import { OfflineIndicator, SimulatedDataBadge, SpaceWeatherBadge } from './StatusBadges';
import { UserMenu } from './UserMenu';

const navClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'relative inline-flex min-h-target min-w-target items-center justify-center gap-2 rounded-control px-2.5 text-sm font-medium',
    'transition-colors duration-200 ease-out',
    isActive
      ? 'bg-surface-2 text-text after:absolute after:inset-x-2 after:-bottom-[10px] after:h-0.5 after:rounded-pill after:bg-brand'
      : 'text-text-2 hover:bg-surface-2 hover:text-text',
  );

/**
 * App header, 64 px (doc 11 §3): mark · nav · mission chip · badges · Measure now / Protocols · user menu.
 * Below 1400 px the nav and action buttons become icon-only (names stay for screen readers and tooltips). When the
 * row still does not fit (glove mode at 1024 px) the right cluster wraps to a second row instead of overlapping.
 */
export function AppHeader() {
  const role = useSessionStore((s) => s.role);
  const swMode = useUiStore((s) => s.spaceWeatherMode);
  const items = navItemsFor(role);
  const canMeasure = role === 'crew' || role === 'cmo';
  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-x-2 gap-y-1 xl:gap-x-3 border-b border-border bg-surface-1 px-3 py-1 xl:px-4">
      <NavLink
        to="/"
        className="flex min-h-target min-w-target shrink-0 items-center justify-center gap-2 rounded-control pr-1"
        aria-label={`${brand.name} home`}
      >
        <BrandMark />
        <span className="font-mono text-base font-semibold tracking-widest text-text max-[1120px]:sr-only">
          {brand.name}
        </span>
      </NavLink>
      <span aria-hidden="true" className="h-8 w-px shrink-0 bg-border max-[1400px]:hidden" />
      <nav aria-label="Main" className="shrink-0">
        <ul className="flex items-center gap-0.5">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'} className={navClass} title={item.label}>
                <item.icon size={18} aria-hidden="true" className="shrink-0 min-[1400px]:hidden" />
                <span className="sr-only min-[1400px]:not-sr-only">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="flex flex-col items-end gap-1">
          <SimulatedDataBadge />
          <span className="inline-flex items-center gap-1">
            <SpaceWeatherBadge mode={swMode} />
            <OfflineIndicator />
            <OfflinePackage />
          </span>
        </div>
        <MissionChip />
        {canMeasure && (
          <LinkButton
            to="/lab"
            variant="primary"
            icon={Crosshair}
            className="max-[1400px]:px-0"
            title="Measure now"
          >
            <span className="sr-only min-[1400px]:not-sr-only">Measure now</span>
          </LinkButton>
        )}
        <LinkButton
          to="/handbook"
          variant="secondary"
          icon={BookOpenText}
          className="max-[1600px]:px-0"
          title="Protocols"
        >
          <span className="sr-only min-[1600px]:not-sr-only">Protocols</span>
        </LinkButton>
        <UserMenu compact />
      </div>
    </header>
  );
}
