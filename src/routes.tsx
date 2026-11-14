import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';

import App from './App';
import type { RouteHandle } from './config/navigation';
import { featureFlags } from './config/featureFlags';
import { RouteLoading } from './ui/RouteLoading';
import { RootLayout } from './ui/shell/RootLayout';

type PageModule = { default: ComponentType };

// Each screen is its own chunk (doc 05 §10: code-split three.js, MediaPipe, Recharts by route).
const page = (load: () => Promise<PageModule>) => async () => ({ Component: (await load()).default });

const CREW_CMO: RouteHandle['roles'] = ['crew', 'cmo'];

/** Routes from docs/05_ARCHITECTURE.md §7, with role gating and shell options in `handle` (RouteHandle). */
export const routes: RouteObject[] = [
  {
    Component: RootLayout,
    HydrateFallback: RouteLoading,
    children: [
      { path: 'sign-in', lazy: page(() => import('./features/auth/SignInPage')) },
      ...(featureFlags.devUiRoute
        ? [{ path: 'dev/ui', lazy: page(() => import('./features/dev/DevUiPage')) }]
        : []),
      {
        path: '/',
        Component: App,
        children: [
          {
            index: true,
            lazy: page(() => import('./features/bridge/BridgePage')),
            handle: { scrubber: true } satisfies RouteHandle,
          },
          {
            path: 'body/:crewId?',
            lazy: page(() => import('./features/body/BodyPage')),
            handle: { roles: CREW_CMO, selfOnly: true, scrubber: true } satisfies RouteHandle,
          },
          {
            path: 'trends/:crewId?',
            lazy: page(() => import('./features/trends/TrendsPage')),
            handle: { selfOnly: true, scrubber: true } satisfies RouteHandle,
          },
          {
            path: 'lab',
            lazy: page(() => import('./features/lab/LabPage')),
            handle: { roles: CREW_CMO } satisfies RouteHandle,
          },
          {
            path: 'lab/:flow',
            lazy: page(() => import('./features/lab/LabPage')),
            handle: { roles: CREW_CMO } satisfies RouteHandle,
          },
          { path: 'environment', lazy: page(() => import('./features/environment/EnvironmentPage')) },
          {
            path: 'crew',
            lazy: page(() => import('./features/crew/CrewPage')),
            handle: { roles: ['cmo', 'surgeon'] } satisfies RouteHandle,
          },
          { path: 'earth', lazy: page(() => import('./features/earthlink/EarthLinkPage')) },
          { path: 'handbook', lazy: page(() => import('./features/handbook/HandbookPage')) },
          { path: 'handbook/:entry', lazy: page(() => import('./features/handbook/HandbookPage')) },
          { path: 'settings', lazy: page(() => import('./features/settings/SettingsPage')) },
          { path: 'limits', lazy: page(() => import('./features/settings/LimitsPage')) },
          { path: '*', lazy: page(() => import('./features/NotFoundPage')) },
        ],
      },
    ],
  },
];
