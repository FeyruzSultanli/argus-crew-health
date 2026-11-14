import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Globe2, KeyRound, Stethoscope, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import crewJson from '../../../seed/crew.json';
import { CMO_CREW_ID, DEMO_PIN, ROLE_LABEL, useSessionStore } from '../../state/session';
import type { Role } from '../../state/session';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/tone';

const ROLES: ReadonlyArray<{ role: Role; icon: LucideIcon; what: string }> = [
  { role: 'crew', icon: UserRound, what: 'Your own data: measure, see your verdicts and plan.' },
  { role: 'cmo', icon: Stethoscope, what: 'Crew Medical Officer: all four crew members.' },
  { role: 'surgeon', icon: Globe2, what: 'On Earth: only data received over the Earth link.' },
];

const cmo = crewJson.crew.find((c) => c.id === CMO_CREW_ID);

export interface RolePickerProps {
  /** Called after a successful sign-in. */
  onSignedIn: () => void;
}

/** Demo sign-in (doc 04 FR-CREW-2): role, crew member for 'crew', demo PIN. */
export function RolePicker({ onSignedIn }: RolePickerProps) {
  const signIn = useSessionStore((s) => s.signIn);
  const [role, setRole] = useState<Role>('crew');
  const [crewId, setCrewId] = useState<string>(crewJson.crew[0]?.id ?? 'c1');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pinId = useId();
  const errId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (signIn({ role, crewId: role === 'crew' ? crewId : undefined, pin })) {
      setError(null);
      onSignedIn();
    } else {
      setError(`That PIN is not the demo PIN. Use ${DEMO_PIN}.`);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" aria-label="Demo sign-in">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-text">Role</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLES.map((r) => {
            const checked = r.role === role;
            return (
              <label
                key={r.role}
                className={cx(
                  'relative flex min-h-target cursor-pointer flex-col gap-1 rounded-card border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand',
                  checked
                    ? 'border-brand bg-brand-bg'
                    : 'border-border bg-surface-2 hover:border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.role}
                  checked={checked}
                  onChange={() => setRole(r.role)}
                  className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-[inherit] opacity-0"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-text">
                  <r.icon size={18} aria-hidden="true" className={checked ? 'text-brand' : 'text-text-2'} />
                  {ROLE_LABEL[r.role]}
                </span>
                <span className="text-xs text-text-2">
                  {r.what}
                  {r.role === 'cmo' && cmo ? ` Signs in as ${cmo.displayName}.` : ''}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {role === 'crew' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-text">Crew member</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {crewJson.crew.map((c) => {
              const checked = c.id === crewId;
              return (
                <label
                  key={c.id}
                  className={cx(
                    'relative flex min-h-target cursor-pointer flex-col justify-center rounded-control border px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand',
                    checked
                      ? 'border-brand bg-brand-bg'
                      : 'border-border bg-surface-2 hover:border-border-strong',
                  )}
                >
                  <input
                    type="radio"
                    name="crew"
                    value={c.id}
                    checked={checked}
                    onChange={() => setCrewId(c.id)}
                    className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-[inherit] opacity-0"
                  />
                  <span className="text-sm text-text">{c.displayName}</span>
                  <span className="text-xs text-text-2">
                    {c.role}
                    {c.isCMO ? ' · CMO' : ''}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={pinId} className="text-sm font-medium text-text">
          Demo PIN
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <span className="relative">
            <KeyRound
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-3"
            />
            <input
              id={pinId}
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errId : undefined}
              className="min-h-target w-40 rounded-control border border-border-strong bg-surface-2 pr-3 pl-9 font-mono text-base tracking-[0.3em] text-text"
            />
          </span>
          <span className="text-sm text-text-2">
            The demo PIN is <span className="font-mono text-text">{DEMO_PIN}</span>.
          </span>
        </div>
        {error && (
          <p id={errId} role="alert" className="text-sm text-act-fg">
            {error}
          </p>
        )}
      </div>

      <div>
        <Button type="submit" variant="primary">
          Sign in as{' '}
          {role === 'crew'
            ? (crewJson.crew.find((c) => c.id === crewId)?.displayName ?? 'crew member')
            : ROLE_LABEL[role]}
        </Button>
      </div>
    </form>
  );
}
