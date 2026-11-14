// Symptoms checklist ids and labels — docs/07_CLINICAL_RULES.md §4.17, from the domain catalog.
// No free-text and no keyword logic.
import { SYMPTOM_KEYS, SYMPTOM_LABELS as DOMAIN_LABELS } from '../../../domain/signals';
import type { SymptomKey } from '../../../domain/signals';

export const SYMPTOM_IDS = SYMPTOM_KEYS;
export type SymptomId = SymptomKey;
export const SYMPTOM_LABELS: Record<SymptomId, string> = DOMAIN_LABELS;
