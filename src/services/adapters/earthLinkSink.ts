// Earth-link sink (FR-EARTH-3): a BroadcastChannel('argus-earth-link') between tabs of the same origin, so a second
// tab signed in as Flight surgeon hears about a packet only once it is delivered, and the crew tab hears about a
// reply once it has travelled back. Dexie (the stored 'delivered' state) stays the source of truth; the channel only
// carries notifications. A shared clock per tab advances the stored states (services/packets.ts).
import { db as defaultDb, type ArgusDB } from '../db';
import { advanceEarthLink } from '../packets';

export const EARTH_LINK_CHANNEL = 'argus-earth-link';

export type EarthLinkEvent =
  | { type: 'packet-delivered'; id: string }
  | { type: 'reply-sent'; id: string }
  | { type: 'reply-delivered'; id: string };

type Listener = (e: EarthLinkEvent) => void;

export interface EarthLinkSink {
  /** Notify this tab's listeners and every other tab. */
  post: (e: EarthLinkEvent) => void;
  subscribe: (fn: Listener) => () => void;
  close: () => void;
}

const isEvent = (x: unknown): x is EarthLinkEvent => {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as { type?: unknown; id?: unknown };
  return (
    (e.type === 'packet-delivered' || e.type === 'reply-sent' || e.type === 'reply-delivered') &&
    typeof e.id === 'string'
  );
};

/** A sink over BroadcastChannel; local-only when the browser has no BroadcastChannel. */
export function createEarthLinkSink(name: string = EARTH_LINK_CHANNEL): EarthLinkSink {
  const listeners = new Set<Listener>();
  const emit = (e: EarthLinkEvent) => listeners.forEach((fn) => fn(e));
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(name) : null;
  if (channel) {
    channel.onmessage = (ev: MessageEvent<unknown>) => {
      if (isEvent(ev.data)) emit(ev.data);
    };
  }
  return {
    post: (e) => {
      emit(e);
      channel?.postMessage(e);
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close: () => {
      listeners.clear();
      channel?.close();
    },
  };
}

let shared: EarthLinkSink | null = null;

/** The tab's sink (created on first use). */
export function getEarthLinkSink(): EarthLinkSink {
  shared ??= createEarthLinkSink();
  return shared;
}

let users = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

/** Default tick of the delivery clock (ms). Not a health number: how often the stored state is refreshed. */
export const CLOCK_TICK_MS = 250;

async function tick(database: ArgusDB, now: () => number): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const res = await advanceEarthLink(now(), database);
    const sink = getEarthLinkSink();
    for (const id of res.packetsDelivered) sink.post({ type: 'packet-delivered', id });
    for (const id of res.repliesDelivered) sink.post({ type: 'reply-delivered', id });
  } catch (err: unknown) {
    console.error('Earth link clock failed', err);
  } finally {
    ticking = false;
  }
}

/** Start (ref-counted) the tab's delivery clock; returns a release function. */
export function acquireEarthLinkClock(database: ArgusDB = defaultDb, now: () => number = Date.now): () => void {
  users++;
  if (!timer) {
    void tick(database, now);
    timer = setInterval(() => void tick(database, now), CLOCK_TICK_MS);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users--;
    if (users <= 0 && timer) {
      clearInterval(timer);
      timer = null;
      users = 0;
    }
  };
}
