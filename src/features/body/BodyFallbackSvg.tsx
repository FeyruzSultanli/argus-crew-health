import type { BodyRegionId, Verdict } from '../../domain/types';
import { useReducedMotionPreference } from '../../state/hooks';
import { TONE, TONE_VAR, VERDICT, cx } from '../../ui/tone';
import type { Hotspot } from './hotspots';
import { ORGAN_SHAPES, SILHOUETTE_HEAD, SILHOUETTE_PATHS } from './silhouette';
import { ANCHORS, LABEL_H, LABEL_W, VIEW_H, VIEW_W, layoutLabels } from './svgLayout';

function fillFor(v: Verdict, flagged: boolean): string {
  return flagged || v === 'EXPECTED' ? TONE_VAR[VERDICT[v].tone] : 'var(--text-3)';
}

export interface BodyFallbackSvgProps {
  hotspots: readonly Hotspot[];
  onSelect: (id: BodyRegionId) => void;
  sexLabel: string;
}

/** 2D fallback body (FR-BODY-6): front silhouette, schematic organs, a labelled button per region. */
export function BodyFallbackSvg({ hotspots, onSelect, sexLabel }: BodyFallbackSvgProps) {
  const reduced = useReducedMotionPreference();
  const visible = hotspots.filter((h) => h.inFilter);
  const labelY = layoutLabels(visible.map((h) => h.id));
  const byId = new Map(hotspots.map((h) => [h.id, h]));

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      role="group"
      aria-label={`Body map, 2D view (${sexLabel} reference outline)`}
      data-testid="body-svg"
    >
      <g aria-hidden="true">
        <ellipse {...SILHOUETTE_HEAD} fill="var(--surface-2)" stroke="var(--border-strong)" />
        {SILHOUETTE_PATHS.map((d) => (
          <path key={d} d={d} fill="var(--surface-2)" stroke="var(--border-strong)" strokeLinejoin="round" />
        ))}
        {ORGAN_SHAPES.map((o, i) => {
          const hs = byId.get(o.region);
          const v = hs?.verdict ?? 'NO_DATA';
          const colour = fillFor(v, hs?.flagged ?? false);
          const dim = hs && !hs.inFilter ? 0.25 : 1;
          if (o.kind === 'path')
            return (
              <path
                key={i}
                d={o.d}
                fill="none"
                stroke={colour}
                strokeWidth={2}
                opacity={0.7 * dim}
                className="transition-[stroke] duration-300 ease-out"
              />
            );
          const [cx, cy, rx, ry] = o.d.split(' ').map(Number);
          return (
            <ellipse
              key={i}
              {...{ cx, cy, rx, ry }}
              fill={colour}
              fillOpacity={hs?.flagged ? 0.45 : 0.22}
              stroke={colour}
              strokeOpacity={0.8}
              opacity={dim}
              className="transition-[fill,stroke] duration-300 ease-out"
            />
          );
        })}
        {visible.map((hs) => {
          const a = ANCHORS[hs.id];
          const y = (labelY[hs.id] ?? a.y) + LABEL_H / 2;
          const x2 = a.side === 'L' ? LABEL_W + 6 : VIEW_W - LABEL_W - 6;
          const colour = fillFor(hs.verdict, hs.flagged);
          return (
            <g key={hs.id}>
              <polyline
                points={`${a.x},${a.y} ${a.side === 'L' ? a.x - 12 : a.x + 12},${y} ${x2},${y}`}
                fill="none"
                stroke={hs.flagged ? colour : 'var(--border-strong)'}
                strokeWidth={hs.selected ? 1.75 : 1}
              />
              {hs.flagged && (
                <circle
                  cx={a.x}
                  cy={a.y}
                  r={9}
                  fill="none"
                  stroke={colour}
                  strokeWidth={2}
                  className={cx(hs.verdict === 'ACT' && !reduced && 'animate-pulse')}
                />
              )}
              <circle cx={a.x} cy={a.y} r={hs.flagged ? 4.5 : 3} fill={colour} />
              {hs.selected && (
                <circle cx={a.x} cy={a.y} r={14} fill="none" stroke="var(--brand)" strokeWidth={1.5} />
              )}
            </g>
          );
        })}
      </g>
      {visible.map((hs) => {
        const a = ANCHORS[hs.id];
        const meta = VERDICT[hs.verdict];
        const Icon = meta.icon;
        const t = TONE[meta.tone];
        return (
          <foreignObject
            key={hs.id}
            x={a.side === 'L' ? 4 : VIEW_W - LABEL_W - 4}
            y={labelY[hs.id] ?? a.y}
            width={LABEL_W}
            height={LABEL_H}
          >
            <button
              type="button"
              data-region={hs.id}
              data-verdict={hs.verdict}
              aria-pressed={hs.selected}
              onClick={() => onSelect(hs.id)}
              className={cx(
                'flex h-full w-full flex-col justify-center rounded-control border px-2 text-left leading-tight',
                a.side === 'L' && 'items-end text-right',
                hs.flagged ? cx(t.bg, t.border) : 'border-border bg-surface-1',
                hs.selected && 'outline-2 outline-offset-1 outline-brand',
              )}
            >
              <span className="text-[13px] font-medium text-text">{hs.label}</span>
              <span className={cx('inline-flex items-center gap-1 text-[12px]', t.text)}>
                <Icon size={12} aria-hidden="true" className={t.icon} />
                {meta.word}
              </span>
            </button>
          </foreignObject>
        );
      })}
    </svg>
  );
}
