import '@testing-library/jest-dom/vitest';
// IndexedDB for the Dexie data layer (DataBoot seeds it when the app shell renders in jsdom).
import 'fake-indexeddb/auto';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// The app shell waits for <DataBoot> (first-run seeding into fake-indexeddb, slower when the whole suite runs in
// parallel), so findBy/waitFor get 5 s instead of the 1-s default.
configure({ asyncUtilTimeout: 15000 });

// Vitest runs without globals, so Testing Library cannot register its automatic cleanup.
afterEach(() => {
  cleanup();
});
