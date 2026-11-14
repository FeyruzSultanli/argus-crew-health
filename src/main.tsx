import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';

import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';

import { ROUTER_BASENAME } from './config/paths';
import { routes } from './routes';
import { startOfflinePackage } from './ui/shell/offlinePackageStore';

// basename: '/' locally and on Vercel, '/argus-crew-health' on GitHub Pages (vite.config.ts ARGUS_BASE).
const router = createBrowserRouter(routes, { basename: ROUTER_BASENAME });

// Service worker registration + first-run offline-package progress (production builds only).
startOfflinePackage();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
