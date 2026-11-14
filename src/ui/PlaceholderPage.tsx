import type { ReactNode } from 'react';

interface PlaceholderPageProps {
  title: string;
  /** One line under the title. */
  summary: string;
  children?: ReactNode;
}

/** Plain page body with a title and one line of text (used by the "Page not found" screen). */
export function PlaceholderPage({ title, summary, children }: PlaceholderPageProps) {
  return (
    <section aria-labelledby="page-title" className="mx-auto max-w-5xl p-6">
      <h1 id="page-title" className="text-2xl font-semibold text-text">
        {title}
      </h1>
      <p className="mt-2 text-text-2">{summary}</p>
      {children}
    </section>
  );
}
