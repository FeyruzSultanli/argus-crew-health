// Types for the handbook content: handbook entries, protocols, limits page data.
// Pure TypeScript — no React, no DOM, no Dexie. The handbook UI consumes exactly these shapes.
import type { Hazard, LayerId, ProtocolId, SignalId, Verdict } from '../../../domain/types';
import type { SymptomKey } from '../../../domain/signals/symptoms';

// ---- Handbook entries (seed/handbook/*.md) ----

export type HandbookCategory = 'signals' | 'measurements' | 'hazards' | 'protocols' | 'about';

/** Category order and labels for the handbook UI (doc 11 §5.8). */
export const HANDBOOK_CATEGORIES: ReadonlyArray<{ id: HandbookCategory; label: string }> = [
  { id: 'signals', label: 'Signals' },
  { id: 'measurements', label: 'Measurements' },
  { id: 'hazards', label: 'Hazards' },
  { id: 'protocols', label: 'Protocols' },
  { id: 'about', label: 'About ARGUS' },
];

/**
 * Fixed body headings per category, in order, so the UI can render entries uniformly. `about` entries have free
 * headings but always end with `Sources`.
 */
export const REQUIRED_SECTIONS: Record<Exclude<HandbookCategory, 'about'>, readonly string[]> = {
  signals: [
    'What it is',
    'Why it matters in space',
    'How to measure',
    'How ARGUS judges it',
    'What to do',
    'Sources',
  ],
  measurements: ['What it is', 'How to measure', 'How ARGUS uses it', 'Honest limits', 'Sources'],
  hazards: ['What it is', 'What ARGUS watches', 'Sources'],
  protocols: ['When ARGUS suggests it', 'Steps', 'Sources'],
};

/** Front-matter fields of one entry. */
export interface HandbookMeta {
  /** kebab-case, unique, stable — used in URLs `/handbook/<id>`. */
  id: string;
  title: string;
  category: HandbookCategory;
  /** Sort key within the category (ascending). */
  order: number;
  /** For signal entries: the SignalId(s) covered. For hazards/protocols: the linked signals. */
  signalIds: SignalId[];
  /** Plain lowercase words a crew member would type; used by search and the rule-based Ask box. */
  keywords: string[];
  /** Every SRC_* id the entry relies on (also the list under `## Sources`). */
  sourceIds: string[];
  /** One sentence, ≤ 160 characters. */
  summary: string;
  /** Hazard entries: which of the five NASA hazards. */
  hazard?: Hazard;
  /** Protocol entries: the protocol in seed/protocols.json. */
  protocolId?: ProtocolId;
  /** True for experimental, not validated features (UI badge "Experimental — not validated"). */
  experimental?: boolean;
}

export interface HandbookSection {
  heading: string;
  /** kebab-case of the heading, e.g. `how-argus-judges-it`. */
  slug: string;
  /** Markdown of the section body (without the heading line), trimmed. */
  markdown: string;
}

export interface HandbookEntry extends HandbookMeta {
  sections: HandbookSection[];
  /** Markdown body after the front matter (all sections), trimmed. */
  body: string;
  /** Non-fatal problems found while parsing (unknown keys, unknown signal ids…). Tests require this to be empty. */
  warnings: string[];
}

/** One row of seed/handbook/index.json. */
export interface HandbookIndexItem extends HandbookMeta {
  /** File name inside seed/handbook/, e.g. `sleep.md`. */
  file: string;
}

export interface HandbookIndexFile {
  _note: string;
  entries: HandbookIndexItem[];
}

// ---- Protocols (seed/protocols.json) ----

export type ProtocolStepTag = 'source' | 'demo wording';

export interface ProtocolStep {
  /** Stable within the protocol: s1, s2, … */
  id: string;
  /** Short imperative sentence = the key step of doc 07 §5, nothing added. */
  text: string;
  tag: ProtocolStepTag;
  /** Non-empty exactly when tag = 'source'. */
  sourceIds: string[];
  /** Only where doc 07 §5 states a time. */
  timerSec?: number;
  /** The final step of every protocol. */
  kind?: 'send-to-surgeon';
  /** The fragment of the doc 07 §5 table this step renders (null for the generic end step). */
  tableText: string | null;
}

/** "This signal's verdict is at least X" — layer omitted = the combined verdict. */
export interface VerdictCondition {
  signal: SignalId;
  layer?: LayerId;
  atLeast: Exclude<Verdict, 'NOMINAL' | 'NO_DATA'>;
}
/** "This symptom is ticked in today's checklist" (keys of doc 07 §4.17). */
export interface SymptomCondition {
  symptom: SymptomKey;
}
/** Cabin value at or above a threshold. */
export interface CabinCondition {
  cabin: 'co2Avg7dMmHg';
  atLeast: number;
}
/** Space-weather state: NOAA S-scale level at least n, or the ≥100 MeV alert on. */
export type SpaceWeatherCondition =
  { spaceWeather: 'sScale'; atLeast: number } | { spaceWeather: 's100Alert' };

export type TriggerCondition = VerdictCondition | SymptomCondition | CabinCondition | SpaceWeatherCondition;
export type TriggerRule = { all: TriggerNode[] } | { any: TriggerNode[] };
export type TriggerNode = TriggerRule | TriggerCondition;

export interface Protocol {
  id: ProtocolId;
  title: string;
  summary: string;
  /** The trigger text of the doc 07 §5 table, verbatim. */
  trigger: string;
  /** The same trigger in plain words, with inline [SRC_…] tags. */
  triggerPlain: string;
  triggerRule: TriggerRule;
  /** Sources of numbers in the trigger. */
  triggerSourceIds: string[];
  /** The source the doc 07 §5 table attaches to the row (may be empty). */
  sourceIds: string[];
  relatedSignalIds: SignalId[];
  keywords: string[];
  steps: ProtocolStep[];
}

export interface ProtocolsFile {
  _note: string;
  protocols: Protocol[];
}

// ---- Limits page (seed/limits.json) ----

export type DataKind = 'real' | 'measured' | 'simulated' | 'modeled' | 'demo' | 'experimental';

export interface LimitsRow {
  id: string;
  kind: DataKind;
  label: string;
  detail: string;
  sourceIds: string[];
  /** Absent = available in this build. */
  availability?: 'unavailable' | 'not-built';
}

export interface KnownGap {
  id: string;
  label: string;
  detail: string;
  sourceIds: string[];
}

export interface LimitsContent {
  _note: string;
  kindLabels: Record<DataKind, string>;
  dataKinds: LimitsRow[];
  notMedicalDevice: string;
  nonGoals: string[];
  knownGaps: KnownGap[];
  rppgValidation: { done: boolean; placeholder: string };
}
