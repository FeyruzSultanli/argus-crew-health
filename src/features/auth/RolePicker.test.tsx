import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '../../state/session';
import { RolePicker } from './RolePicker';

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().signOut();
});

describe('RolePicker', () => {
  it('offers the three roles and the four crew members', () => {
    render(<RolePicker onSignedIn={() => {}} />);
    for (const r of ['Crew member', 'CMO', 'Flight surgeon'])
      expect(screen.getByRole('radio', { name: new RegExp(`^${r}`) })).toBeInTheDocument();
    for (const c of ['R. Vance', 'M. Ito', 'K. Osei', 'L. Duarte'])
      expect(screen.getByRole('radio', { name: new RegExp(`^${c}`) })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Demo sign-in' })).toBeInTheDocument();
  });

  it('rejects a wrong PIN with an alert', () => {
    const done = vi.fn();
    render(<RolePicker onSignedIn={done} />);
    fireEvent.change(screen.getByLabelText('Demo PIN'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in as/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('2026');
    expect(done).not.toHaveBeenCalled();
    expect(useSessionStore.getState().signedIn).toBe(false);
  });

  it('signs in a chosen crew member with PIN 2026', () => {
    const done = vi.fn();
    render(<RolePicker onSignedIn={done} />);
    fireEvent.click(screen.getByRole('radio', { name: /K\. Osei/ }));
    fireEvent.change(screen.getByLabelText('Demo PIN'), { target: { value: '2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in as K. Osei' }));
    expect(done).toHaveBeenCalledOnce();
    expect(useSessionStore.getState()).toMatchObject({ role: 'crew', crewId: 'c3', signedIn: true });
  });

  it('CMO signs in as L. Duarte; the crew list hides for other roles', () => {
    render(<RolePicker onSignedIn={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: /^CMO/ }));
    expect(screen.queryByRole('radio', { name: /R\. Vance/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Demo PIN'), { target: { value: '2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in as CMO' }));
    expect(useSessionStore.getState()).toMatchObject({ role: 'cmo', crewId: 'c4' });
  });
});
