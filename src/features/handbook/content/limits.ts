// Limits & honesty page content (FR-SET-3) from seed/limits.json — imported statically and validated at load.
import limitsJson from '../../../../seed/limits.json';
import type { LimitsContent } from './types';
import { validateLimits } from './validate';

/** Throws at import time if seed/limits.json is malformed. */
export const limits: LimitsContent = validateLimits(limitsJson);
