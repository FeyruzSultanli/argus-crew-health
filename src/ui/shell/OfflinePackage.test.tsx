import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfflinePackage } from './OfflinePackage';
import { setOfflinePackageState, startOfflinePackage } from './offlinePackageStore';

afterEach(() => {
  act(() => setOfflinePackageState({ phase: 'idle' }));
  vi.useRealTimers();
});

describe('OfflinePackage', () => {
  it('is an empty, polite live region while idle (dev / already offline-ready)', () => {
    render(<OfflinePackage />);
    const el = screen.getByTestId('offline-package');
    expect(el).toHaveAttribute('role', 'status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveAttribute('data-phase', 'idle');
    expect(el).toHaveTextContent('');
  });

  it('shows progress while preparing, then "Ready to work offline", then hides after a few seconds', () => {
    vi.useFakeTimers();
    render(<OfflinePackage />);
    const el = screen.getByTestId('offline-package');
    act(() => setOfflinePackageState({ phase: 'preparing', done: 0, total: null }));
    expect(el).toHaveTextContent('Preparing offline package');
    act(() => setOfflinePackageState({ phase: 'preparing', done: 69, total: 138 }));
    expect(el).toHaveTextContent('Preparing offline package 50 %');
    expect(el).toHaveAttribute('title', '69 of 138 files stored for offline use');
    act(() => setOfflinePackageState({ phase: 'ready' }));
    expect(el).toHaveTextContent('Ready to work offline');
    act(() => vi.advanceTimersByTime(8000));
    expect(el).toHaveAttribute('data-phase', 'idle');
  });

  it('says when the package could not be stored', () => {
    render(<OfflinePackage />);
    act(() => setOfflinePackageState({ phase: 'error' }));
    expect(screen.getByTestId('offline-package')).toHaveTextContent('Offline package not stored — stay online');
  });

  it('does not register a service worker outside production builds', () => {
    const register = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { controller: null, register } });
    startOfflinePackage();
    expect(register).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
