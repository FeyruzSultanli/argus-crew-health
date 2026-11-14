import type { ReactNode } from 'react';

/** Section wrapper for /dev/ui. */
export function GallerySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <h2 id={`${id}-title`} className="mb-4 text-xl font-semibold text-text">
        {title}
      </h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** One component demo with a mono caption naming it. */
export function Demo({ name, note, children }: { name: string; note?: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface-1 p-5">
      <h3 className="font-mono text-sm text-text">{name}</h3>
      {note && <p className="mt-1 text-xs text-text-2">{note}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
