// Feature hooks for the Earth link screen: a ticking clock and the (debounced) packet preview.
import { useEffect, useState } from 'react';

import type { PacketRequest } from '../../domain/types';
import { composePacket, type Composed } from '../../services/packets';

/** Date.now(), refreshed every `ms`. */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export interface PreviewState {
  composed?: Composed;
  error?: string;
  loading: boolean;
}

/** Composes the packet for the current request (bundle, summary, size) after a short debounce. */
export function usePacketPreview(req: PacketRequest | null): PreviewState {
  const key = req ? JSON.stringify(req) : '';
  const [state, setState] = useState<{ key: string; composed?: Composed; error?: string }>({ key: '' });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const t = window.setTimeout(() => {
      composePacket(JSON.parse(key) as PacketRequest)
        .then((composed) => alive && setState({ key, composed }))
        .catch((err: unknown) => alive && setState({ key, error: err instanceof Error ? err.message : String(err) }));
    }, 150);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [key]);
  if (!key) return { loading: false };
  if (state.key !== key) return { loading: true, composed: state.composed };
  return { loading: false, composed: state.composed, error: state.error };
}
