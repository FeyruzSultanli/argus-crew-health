import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { LazyMotion, MotionConfig } from 'motion/react';

import { DataBoot } from '../../services/DataBoot';
import { useApplyPreferences } from '../../state/hooks';
import { useUiStore } from '../../state/ui';
import { SourceDrawerProvider } from '../SourceDrawer';
import { ToastProvider } from '../Toast';

const loadMotionFeatures = () => import('../motionFeatures').then((mod) => mod.domAnimation);

/** Providers every screen needs: theme attributes, motion policy, toasts, source drawer. */
export function AppProviders({ children }: { children: ReactNode }) {
  useApplyPreferences();
  const reduced = useUiStore((s) => s.reducedMotion);
  return (
    // 'user' follows prefers-reduced-motion; the in-app setting forces it on (doc 11 §1.5).
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'} transition={{ duration: 0.2, ease: 'easeOut' }}>
      {/* LazyMotion + `m` components keep the motion runtime small; the domAnimation feature set loads async. */}
      <LazyMotion features={loadMotionFeatures} strict>
        <ToastProvider>
          <SourceDrawerProvider><DataBoot>{children}</DataBoot></SourceDrawerProvider>
        </ToastProvider>
      </LazyMotion>
    </MotionConfig>
  );
}

/** Top-level route element: providers around every route (sign-in, /dev/ui and the shell). */
export function RootLayout() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}
