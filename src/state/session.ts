// Session store (doc 05 §5): who is signed in, in which role. Demo sign-in only (doc 04 FR-CREW-2) — persisted
// in localStorage so a reload keeps the role; a second browser tab can sign in as Flight surgeon.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import crewJson from '../../seed/crew.json';

/** The three demo roles (doc 04 FR-CREW-2). */
export type Role = 'crew' | 'cmo' | 'surgeon';

/** Demo PIN shown on the sign-in screen. This is not security; it only makes the demo sign-in deliberate. */
export const DEMO_PIN = '2026';

/** Crew id of the Crew Medical Officer (seed/crew.json `isCMO`). */
export const CMO_CREW_ID: string = crewJson.crew.find((c) => c.isCMO)?.id ?? 'c4';

/** Human label per role. */
export const ROLE_LABEL: Record<Role, string> = {
  crew: 'Crew member',
  cmo: 'CMO',
  surgeon: 'Flight surgeon',
};

export interface SignInInput {
  role: Role;
  /** Required for 'crew'; ignored for 'cmo' (always the CMO crew member) and 'surgeon' (on Earth). */
  crewId?: string;
  pin: string;
}

export interface SessionState {
  role: Role | null;
  /** Signed-in crew member: own id for 'crew', the CMO's id for 'cmo', null for 'surgeon'. */
  crewId: string | null;
  signedIn: boolean;
  /** Returns false (and changes nothing) on a wrong PIN or a crew role without a valid crew id. */
  signIn: (input: SignInInput) => boolean;
  signOut: () => void;
}

const crewIds = new Set(crewJson.crew.map((c) => c.id));

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      crewId: null,
      signedIn: false,
      signIn: ({ role, crewId, pin }) => {
        if (pin.trim() !== DEMO_PIN) return false;
        if (role === 'crew' && (!crewId || !crewIds.has(crewId))) return false;
        const id = role === 'crew' ? (crewId ?? null) : role === 'cmo' ? CMO_CREW_ID : null;
        set({ role, crewId: id, signedIn: true });
        return true;
      },
      signOut: () => set({ role: null, crewId: null, signedIn: false }),
    }),
    {
      name: 'argus.session',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ role: s.role, crewId: s.crewId, signedIn: s.signedIn }),
    },
  ),
);
