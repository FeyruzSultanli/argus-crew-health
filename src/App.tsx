import { useMemo } from 'react';
import { Navigate, Outlet, useLocation, useMatches } from 'react-router';
import { ShieldOff } from 'lucide-react';

import type { RouteHandle } from './config/navigation';
import { startReplay } from './services/replay';
import { useSessionStore, ROLE_LABEL } from './state/session';
import { useUiStore } from './state/ui';
import { LinkButton } from './ui/Button';
import { EmptyState } from './ui/States';
import { useToast } from './ui/toastContext';
import { AppHeader } from './ui/shell/AppHeader';
import { FocusedFlowBar } from './ui/shell/FocusedFlowBar';
import { MissionScrubber } from './ui/shell/MissionScrubber';

/** Merge the `handle` of every matched route; the deepest one wins per key. */
function useRouteHandle(): { handle: RouteHandle; params: Record<string, string | undefined> } {
  const matches = useMatches();
  const handle = matches.reduce<RouteHandle>(
    (acc, m) => ({ ...acc, ...((m.handle as RouteHandle | undefined) ?? {}) }),
    {},
  );
  return { handle, params: matches[matches.length - 1]?.params ?? {} };
}

/**
 * Root shell (doc 11 §3): header (or the thin focused-flow bar), page, mission scrubber dock on Bridge/Body/Trends.
 * Role gating per doc 05 §7: not signed in → role picker; role not allowed → explanation; crew sees only self.
 */
export default function App() {
  const location = useLocation();
  const { handle, params } = useRouteHandle();
  const signedIn = useSessionStore((s) => s.signedIn);
  const role = useSessionStore((s) => s.role);
  const crewId = useSessionStore((s) => s.crewId);
  const focusedFlow = useUiStore((s) => s.focusedFlow);
  const setFocusedFlow = useUiStore((s) => s.setFocusedFlow);
  const density = useUiStore((s) => s.flagDensity);
  const toast = useToast();
  // <Navigate> re-runs its navigate() effect whenever its `state` prop changes identity. A fresh object literal on
  // every render made each redirect start a new navigation, whose pending state re-rendered this component, which
  // made a new object, … — "Maximum update depth exceeded" whenever the lazy /sign-in chunk loaded slowly (parallel
  // e2e workers). The memoised state keeps the effect to one run per requested location.
  const from = location.pathname + location.search;
  const signInState = useMemo(() => ({ from }), [from]);

  if (!signedIn || !role) return <Navigate to="/sign-in" replace state={signInState} />;

  if (handle.selfOnly && role === 'crew' && crewId && params.crewId && params.crewId !== crewId) {
    const base = location.pathname.split('/')[1] ?? '';
    return <Navigate to={`/${base}/${crewId}`} replace />;
  }

  const allowed = !handle.roles || handle.roles.includes(role);
  const flow = focusedFlow ?? (handle.focused ? { title: 'Measurement', exitTo: '/lab' } : null);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only-focusable fixed top-2 left-2 z-[70] inline-flex min-h-target items-center rounded-control bg-brand px-4 text-brand-fg"
      >
        Skip to content
      </a>
      {flow ? <FocusedFlowBar flow={flow} onExit={() => setFocusedFlow(null)} /> : <AppHeader />}
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {allowed ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-xl p-6">
            <EmptyState
              icon={ShieldOff}
              title="Not available for this role"
              body={`The ${ROLE_LABEL[role]} role cannot open this screen. Switch role from the user menu to see it.`}
              action={<LinkButton to="/">Back to the Mission Bridge</LinkButton>}
            />
          </div>
        )}
      </main>
      {handle.scrubber && allowed && !flow && (
        <div className="sticky bottom-0 z-20">
          <MissionScrubber
            density={density}
            onReplay={() =>
              void startReplay().then(() =>
                toast.show({
                  title: 'SPE replay started',
                  body: 'REPLAY: synthetic S2-class profile (demo), not a recorded event. See Environment.',
                }),
              )
            }
          />
        </div>
      )}
    </div>
  );
}
