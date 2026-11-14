import type { RefObject } from 'react';

import type { BodyRegionId } from '../domain/types';
import type { Hotspot } from '../features/body/hotspots';
import { TONE, VERDICT, cx } from '../ui/tone';
import type { Vec3 } from './anatomyMap';

/** DOM nodes of the hotspot markers, positioned every rendered frame by <HotspotProjector>. */
export type HotspotRegistry = RefObject<Map<BodyRegionId, HTMLDivElement>>;

export interface HotspotOverlayProps {
  hotspots: readonly Hotspot[];
  anchors: Record<BodyRegionId, Vec3>;
  onSelect: (id: BodyRegionId) => void;
  reducedMotion: boolean;
  registry: HotspotRegistry;
}

/**
 * Hotspot markers (doc 11 §6): rings with leader labels for WATCH/ACT regions, subtle dots otherwise. One DOM layer
 * over the canvas (no per-marker React roots). Pointer only — keyboard users get the region list next to the canvas,
 * so the layer is hidden from assistive tech.
 */
export function HotspotOverlay({
  hotspots,
  anchors,
  onSelect,
  reducedMotion,
  registry,
}: HotspotOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="hotspot-overlay"
    >
      {hotspots
        .filter((h) => h.inFilter)
        .map((h) => {
          const meta = VERDICT[h.verdict];
          const t = TONE[meta.tone];
          const Icon = meta.icon;
          const showLabel = h.flagged || h.selected;
          const leftSide = anchors[h.id][0] < 0;
          return (
            <div
              key={h.id}
              ref={(el) => {
                if (el) registry.current.set(h.id, el);
                else registry.current.delete(h.id);
              }}
              className="absolute top-0 left-0 will-change-transform"
              style={{ visibility: 'hidden', zIndex: h.selected ? 3 : h.flagged ? 2 : 1 }}
            >
              <div className="relative -translate-x-1/2 -translate-y-1/2">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => onSelect(h.id)}
                  data-hotspot={h.id}
                  className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-pill"
                  title={`${h.label}: ${meta.word}`}
                >
                  {h.flagged && (
                    <span
                      className={cx(
                        'absolute inset-2.5 rounded-pill border-2',
                        t.border,
                        h.verdict === 'ACT' && !reducedMotion && 'animate-ping',
                      )}
                      style={{ borderColor: `var(--${meta.tone})` }}
                    />
                  )}
                  {h.selected && (
                    <span
                      className={cx(
                        'absolute inset-1 rounded-pill border border-brand',
                        !reducedMotion && 'animate-pulse',
                      )}
                    />
                  )}
                  <span
                    className="block rounded-pill"
                    style={{
                      width: h.flagged ? 10 : 6,
                      height: h.flagged ? 10 : 6,
                      background:
                        h.flagged || h.verdict === 'EXPECTED' ? `var(--${meta.tone})` : 'var(--text-3)',
                      opacity: h.flagged ? 1 : 0.7,
                    }}
                  />
                </button>
                {showLabel && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onSelect(h.id)}
                    className={cx(
                      'pointer-events-auto absolute top-1/2 flex min-h-11 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap',
                      leftSide ? 'right-full flex-row-reverse' : 'left-full',
                    )}
                  >
                    <span
                      className="h-px w-8"
                      style={{ background: h.flagged ? `var(--${meta.tone})` : 'var(--brand)' }}
                    />
                    <span
                      className={cx(
                        'inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-xs font-medium backdrop-blur-sm',
                        h.flagged ? cx(t.bg, t.border) : 'border-brand bg-surface-1/80',
                      )}
                    >
                      <span className="text-text">{h.label}</span>
                      <Icon size={12} aria-hidden="true" className={t.icon} />
                      <span className={t.text}>{meta.word}</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
