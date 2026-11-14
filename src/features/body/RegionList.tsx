import type { BodyRegionId } from '../../domain/types';
import { TONE, VERDICT, cx } from '../../ui/tone';
import type { Hotspot } from './hotspots';

/**
 * Keyboard and screen-reader mirror of the 3D hotspots (the canvas itself is not focusable). Visually hidden until a
 * button inside receives focus; then it shows as a panel over the scene.
 */
export function RegionList({
  hotspots,
  onSelect,
}: {
  hotspots: readonly Hotspot[];
  onSelect: (id: BodyRegionId) => void;
}) {
  const visible = hotspots.filter((h) => h.inFilter);
  return (
    <nav
      aria-label="Body regions"
      className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-3 focus-within:left-3 focus-within:z-20 focus-within:max-w-[calc(100%-1.5rem)] focus-within:rounded-card focus-within:border focus-within:border-border focus-within:bg-surface-1 focus-within:p-2"
    >
      <ul className="flex flex-wrap gap-1">
        {visible.map((h) => {
          const meta = VERDICT[h.verdict];
          const Icon = meta.icon;
          const t = TONE[meta.tone];
          return (
            <li key={h.id}>
              <button
                type="button"
                data-region={h.id}
                data-verdict={h.verdict}
                aria-pressed={h.selected}
                onClick={() => onSelect(h.id)}
                className={cx(
                  'inline-flex min-h-target items-center gap-1.5 rounded-control border px-2.5 text-sm',
                  h.flagged ? cx(t.bg, t.border) : 'border-border bg-surface-2',
                )}
              >
                <span className="text-text">{h.label}</span>
                <Icon size={13} aria-hidden="true" className={t.icon} />
                <span className={t.text}>{meta.word}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
