// Test-only wrapper: the providers the Settings / Handbook screens need (motion, toasts, source drawer, router).
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { SourceDrawerProvider, ToastProvider } from '../../ui';

export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="always">
      <LazyMotion features={domAnimation} strict>
        <ToastProvider>
          <SourceDrawerProvider>{children}</SourceDrawerProvider>
        </ToastProvider>
      </LazyMotion>
    </MotionConfig>
  );
}

/** Renders `element` at `path` (route pattern `pattern`) inside the providers. */
// eslint-disable-next-line react-refresh/only-export-components -- test helper, never hot-reloaded
export function renderAt(element: ReactNode, path = '/', pattern = '*') {
  const routes = [{ path: pattern, element: <TestProviders>{element}</TestProviders> }];
  if (pattern !== '*') routes.push({ path: '*', element: <TestProviders>{element}</TestProviders> });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}
