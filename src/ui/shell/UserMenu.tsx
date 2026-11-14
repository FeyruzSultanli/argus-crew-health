import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronDown, LogOut } from 'lucide-react';

import { navItemsFor, secondaryNavItems } from '../../config/navigation';
import { useSessionIdentity } from '../../state/hooks';
import { useSessionStore } from '../../state/session';
import { cx } from '../tone';
import { PreferencesControls } from './PreferencesControls';

const ITEM =
  'flex min-h-target w-full items-center gap-2 rounded-control px-2 text-sm text-text hover:bg-surface-2';

/** User/role menu: who is signed in, Settings, Limits, theme/glove/motion, switch role (doc 11 §3). */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const navigate = useNavigate();
  const role = useSessionStore((s) => s.role);
  const signOut = useSessionStore((s) => s.signOut);
  const { name, roleLabel, initials } = useSessionIdentity();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-target min-w-target items-center gap-2 rounded-control px-1.5 hover:bg-surface-2"
        data-testid="user-menu"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-pill border border-border-strong bg-surface-2 font-mono text-xs text-text"
        >
          {initials}
        </span>
        <span className={cx('flex flex-col text-left leading-tight', compact && 'sr-only')}>
          <span className="text-sm text-text">{name}</span>
          <span className="text-xs text-text-2">{roleLabel}</span>
        </span>
        {compact && <span className="sr-only">, account and display settings</span>}
        <ChevronDown size={16} aria-hidden="true" className="text-text-3 max-[1400px]:hidden" />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 z-40 mt-2 w-80 rounded-card border border-border-strong bg-surface-1 p-2 shadow-overlay"
        >
          <p className="px-2 pt-1 pb-2 text-xs text-text-2">
            Signed in as <span className="text-text">{name}</span> · {roleLabel}
            <span className="block text-text-3">Demo sign-in, not real authentication.</span>
          </p>
          <nav aria-label="Account">
            <ul>
              {navItemsFor(role, secondaryNavItems).map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={ITEM} onClick={() => setOpen(false)}>
                    <item.icon size={16} aria-hidden="true" className="text-text-2" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="my-2 border-t border-border" />
          <p className="px-2 pb-1 text-xs font-semibold tracking-wider text-text-3 uppercase">Display</p>
          <PreferencesControls />
          <div className="my-2 border-t border-border" />
          <button
            type="button"
            className={ITEM}
            onClick={() => {
              signOut();
              setOpen(false);
              navigate('/sign-in');
            }}
          >
            <LogOut size={16} aria-hidden="true" className="text-text-2" />
            Sign out / switch role
          </button>
        </div>
      )}
    </div>
  );
}
