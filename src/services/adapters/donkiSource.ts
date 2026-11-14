// NASA DONKI SEP event list (doc 10 §1) [SRC_DONKI] — not connected in this build.
// On 2026-11-14 the CCMC host kauai.ccmc.gsfc.nasa.gov reset every TLS connection (nine attempts, then one
// more at 14:36 UTC) and api.nasa.gov with DEMO_KEY returned 429, so the real response shape could not be inspected
// and the browser's CORS answer is unknown. The bundled seed/radiation/donki-sep-365.json is an honest empty record
// (`status: "unavailable"`). This adapter makes no network call (a reset connection would only add console errors);
// it reports that record so the Environment screen can say the list is unavailable. No events are invented.
import type { SpaceWeatherState } from '../../domain/types';

export interface DonkiFeed {
  status: 'unavailable' | 'ok';
  events: SpaceWeatherState['sepEvents'];
  /** When the (failed) download was attempted, ISO UTC. */
  attemptedAt: string;
  note: string;
  sourceIds: string[];
}

export const DONKI_PAGE = 'https://ccmc.gsfc.nasa.gov/tools/DONKI';

let donkiPromise: Promise<DonkiFeed> | null = null;

export function loadSepEvents(): Promise<DonkiFeed> {
  donkiPromise ??= import('../../../seed/radiation/donki-sep-365.json').then((m) => {
    const j = m.default as {
      status?: string;
      fetchedAt?: string;
      note?: string;
      sourceIds?: string[];
      events?: unknown[];
    };
    // Only the honest-empty record is supported in this build: events stay [] until a real response shape is checked.
    return {
      status: 'unavailable',
      events: [],
      attemptedAt: j.fetchedAt ?? '',
      note: j.note ?? '',
      sourceIds: j.sourceIds ?? ['SRC_DONKI'],
    };
  });
  return donkiPromise;
}
