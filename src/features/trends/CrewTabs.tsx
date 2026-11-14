// CMO crew switcher: one link per crew member (doc 05 §7: the CMO sees any crew member's trends).
import { NavLink } from 'react-router';

import crewJson from '../../../seed/crew.json';
import { cx } from '../../ui/tone';

export function CrewTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Crew member" className="flex flex-wrap gap-2">
      {crewJson.crew.map((c) => {
        const active = c.id === current;
        return (
          <NavLink
            key={c.id}
            to={`/trends/${c.id}`}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'inline-flex min-h-11 items-center rounded-control border px-4 text-sm font-medium',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              active ? 'border-brand bg-brand-bg text-text' : 'border-border text-text-2 hover:bg-surface-2',
            )}
          >
            {c.displayName}
            <span className="sr-only">{active ? ' (shown)' : ''}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
