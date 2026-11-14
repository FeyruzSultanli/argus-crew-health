import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

import { Badge } from './Badge';
import { Sheet } from './Sheet';
import { SourceDrawerContext } from './sourceDrawerContext';
import type { SourceDrawerApi } from './sourceDrawerContext';
import { SOURCE_STATUS, getSource } from './sources';
import type { SourceStatus } from '../domain/types';

export interface SourceDrawerProps {
  open: boolean;
  onClose: () => void;
  sourceIds: readonly string[];
  /** What these sources back, e.g. "Resting heart rate". */
  title?: string;
}

const STATUS_TONE: Record<SourceStatus, 'ok' | 'watch' | 'neutral'> = {
  verified: 'ok',
  partial: 'watch',
  demo: 'neutral',
};

/** Right sheet listing the sources behind a card or number, with status and link (doc 11 §4). */
export function SourceDrawer({ open, onClose, sourceIds, title }: SourceDrawerProps) {
  const unique = Array.from(new Set(sourceIds));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Sources"
      description={title ? `Behind: ${title}` : 'Where these numbers come from.'}
    >
      <ul className="flex flex-col gap-3">
        {unique.map((id) => {
          const s = getSource(id);
          if (!s) {
            return (
              <li key={id} className="rounded-card border border-watch-border bg-watch-bg p-4 text-sm">
                <p className="font-mono text-xs text-text-2">{id}</p>
                <p className="mt-1 text-text">Not in the source registry. Treat this number as unverified.</p>
              </li>
            );
          }
          const meta = SOURCE_STATUS[s.status];
          return (
            <li key={id} className="rounded-card border border-border bg-surface-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[s.status]}>
                  <span aria-hidden="true" className="font-mono">
                    {meta.glyph}
                  </span>
                  {meta.label}
                </Badge>
                <span className="font-mono text-xs text-text-3">{s.id}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-text">{s.title}</p>
              {s.publisher && <p className="text-xs text-text-2">{s.publisher}</p>}
              <p className="mt-2 text-sm text-text-2">{s.says}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-target items-center gap-1.5 text-sm text-brand underline underline-offset-2"
                  >
                    Open source <ExternalLink size={14} aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="text-xs text-text-3">No public link confirmed.</span>
                )}
                {s.accessed && <span className="font-mono text-xs text-text-3">accessed {s.accessed}</span>}
              </div>
            </li>
          );
        })}
        {unique.length === 0 && (
          <li className="text-sm text-text-2">No source attached — shown as a demo parameter.</li>
        )}
      </ul>
    </Sheet>
  );
}

/** Provides `useSourceDrawer()` to every <Value> and card below it; renders one shared drawer. */
export function SourceDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ ids: readonly string[]; title?: string; open: boolean }>({
    ids: [],
    open: false,
  });
  const open = useCallback(
    (ids: readonly string[], title?: string) => setState({ ids, title, open: true }),
    [],
  );
  const api = useMemo<SourceDrawerApi>(() => ({ open }), [open]);
  return (
    <SourceDrawerContext.Provider value={api}>
      {children}
      <SourceDrawer
        open={state.open}
        onClose={() => setState((s) => ({ ...s, open: false }))}
        sourceIds={state.ids}
        title={state.title}
      />
    </SourceDrawerContext.Provider>
  );
}
