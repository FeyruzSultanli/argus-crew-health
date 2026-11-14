// Status tones and verdict metadata (doc 07 §2, doc 11 §7). Colour means status — nothing else (doc 11 §1.2).
// Class strings are spelled out statically so Tailwind can see them.
import { CircleCheck, CircleDashed, Eye, Orbit, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Verdict } from '../domain/types';

export type Tone = 'ok' | 'info' | 'watch' | 'act' | 'muted';

/** Join class names, skipping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export interface ToneClasses {
  /** text colour (AA on surfaces and on the -bg tint) */
  text: string;
  /** icon / stroke colour (spec hue) */
  icon: string;
  bg: string;
  border: string;
  /** solid fill (bars, dots) */
  fill: string;
  /** left accent border for cards and toasts */
  accent: string;
}

export const TONE: Record<Tone, ToneClasses> = {
  ok: {
    text: 'text-ok-fg',
    icon: 'text-ok',
    bg: 'bg-ok-bg',
    border: 'border-ok-border',
    fill: 'bg-ok',
    accent: 'border-l-ok',
  },
  info: {
    text: 'text-info-fg',
    icon: 'text-info',
    bg: 'bg-info-bg',
    border: 'border-info-border',
    fill: 'bg-info',
    accent: 'border-l-info',
  },
  watch: {
    text: 'text-watch-fg',
    icon: 'text-watch',
    bg: 'bg-watch-bg',
    border: 'border-watch-border',
    fill: 'bg-watch',
    accent: 'border-l-watch',
  },
  act: {
    text: 'text-act-fg',
    icon: 'text-act',
    bg: 'bg-act-bg',
    border: 'border-act-border',
    fill: 'bg-act',
    accent: 'border-l-act',
  },
  muted: {
    text: 'text-muted-fg',
    icon: 'text-muted-fg',
    bg: 'bg-muted-bg',
    border: 'border-muted-border',
    fill: 'bg-muted',
    accent: 'border-l-muted',
  },
};

/** CSS variable of a tone's hue, for SVG / Recharts strokes and fills. */
export const TONE_VAR: Record<Tone, string> = {
  ok: 'var(--ok)',
  info: 'var(--info)',
  watch: 'var(--watch)',
  act: 'var(--act)',
  muted: 'var(--muted)',
};

export interface VerdictMeta {
  /** Exact UI word (doc 11 §7). */
  word: string;
  tone: Tone;
  icon: LucideIcon;
  /** Meaning shown to the user (doc 07 §2). */
  meaning: string;
  /** NOMINAL 0 … ACT 3; NO_DATA −1 (doc 07 §3 step 3). */
  severity: number;
}

export const VERDICT: Record<Verdict, VerdictMeta> = {
  NOMINAL: {
    word: 'Nominal',
    tone: 'ok',
    icon: CircleCheck,
    meaning: 'Within your usual range.',
    severity: 0,
  },
  EXPECTED: {
    word: 'Expected in space',
    tone: 'info',
    icon: Orbit,
    meaning: 'A known change in space. Keep doing your countermeasures.',
    severity: 1,
  },
  WATCH: {
    word: 'Watch',
    tone: 'watch',
    icon: Eye,
    meaning: 'Unusual. Re-measure and keep an eye on it.',
    severity: 2,
  },
  ACT: {
    word: 'Act',
    tone: 'act',
    icon: TriangleAlert,
    meaning: 'Needs action now. Follow the next step and tell the CMO.',
    severity: 3,
  },
  NO_DATA: {
    word: 'No data',
    tone: 'muted',
    icon: CircleDashed,
    meaning: 'No recent reading. Measure to update.',
    severity: -1,
  },
};

/** All verdicts, most severe first (for sorting and demos). */
export const VERDICTS: readonly Verdict[] = ['ACT', 'WATCH', 'EXPECTED', 'NOMINAL', 'NO_DATA'];

/** Worst verdict of a list (ACT > WATCH > EXPECTED > NOMINAL > NO_DATA); NO_DATA for an empty list. */
export function worstVerdict(verdicts: readonly Verdict[]): Verdict {
  return verdicts.reduce<Verdict>((w, v) => (VERDICT[v].severity > VERDICT[w].severity ? v : w), 'NO_DATA');
}
