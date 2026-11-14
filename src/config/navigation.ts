// Navigation and role gating (doc 11 §3 header, doc 05 §7 routing table).
import {
  BookOpen,
  ChartLine,
  Earth,
  FlaskConical,
  LayoutDashboard,
  PersonStanding,
  Radiation,
  Scale,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Role } from '../state/session';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Roles that may open this screen (doc 05 §7). */
  roles: readonly Role[];
}

const ALL: readonly Role[] = ['crew', 'cmo', 'surgeon'];

/** Primary navigation in the header (doc 11 §3). */
export const navItems: readonly NavItem[] = [
  { to: '/', label: 'Bridge', icon: LayoutDashboard, roles: ALL },
  { to: '/body', label: 'Body', icon: PersonStanding, roles: ['crew', 'cmo'] },
  { to: '/trends', label: 'Trends', icon: ChartLine, roles: ALL },
  { to: '/lab', label: 'Lab', icon: FlaskConical, roles: ['crew', 'cmo'] },
  { to: '/environment', label: 'Environment', icon: Radiation, roles: ALL },
  { to: '/crew', label: 'Crew', icon: Users, roles: ['cmo', 'surgeon'] },
  { to: '/earth', label: 'Earth', icon: Earth, roles: ALL },
  { to: '/handbook', label: 'Handbook', icon: BookOpen, roles: ALL },
];

/** Secondary destinations, in the user menu (doc 11 §3: Settings/Limits move out of the main nav). */
export const secondaryNavItems: readonly NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings, roles: ALL },
  { to: '/limits', label: 'Limits & honesty', icon: Scale, roles: ALL },
];

/**
 * Route `handle` used by routes.tsx and read by the shell (useMatches):
 * - roles: who may open it (missing = everyone signed in)
 * - selfOnly: a 'crew' user is redirected to their own :crewId
 * - scrubber: show the mission scrubber dock (Bridge, Body, Trends — doc 11 §3)
 * - focused: render with the thin focused-flow header (Lab flows can also use useFocusedFlow)
 */
export interface RouteHandle {
  roles?: readonly Role[];
  selfOnly?: boolean;
  scrubber?: boolean;
  focused?: boolean;
}

/** Nav items visible to a role. */
export function navItemsFor(role: Role | null, items: readonly NavItem[] = navItems): NavItem[] {
  return role ? items.filter((i) => i.roles.includes(role)) : [];
}
