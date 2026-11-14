import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

import { BrandMark } from '../../ui/BrandMark';
import { PreferencesControls } from '../../ui/shell/PreferencesControls';
import { SimulatedDataBadge } from '../../ui/shell/StatusBadges';
import { CardsSection } from './sections/CardsSection';
import { ChartsSection } from './sections/ChartsSection';
import { ControlsSection } from './sections/ControlsSection';
import { ShellSection } from './sections/ShellSection';
import { StatesSection } from './sections/StatesSection';
import { StatusSection } from './sections/StatusSection';

const SECTIONS = [
  { id: 'status', label: 'Status & values' },
  { id: 'cards', label: 'Cards' },
  { id: 'charts', label: 'Charts & gauges' },
  { id: 'controls', label: 'Controls' },
  { id: 'states', label: 'States & feedback' },
  { id: 'shell', label: 'Shell' },
] as const;

/** /dev/ui — hidden component gallery (not in the nav). Every component, every verdict, themes and glove mode live. */
export default function DevUiPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-surface-1">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-2">
          <Link
            to="/"
            className="inline-flex min-h-target min-w-target items-center gap-2 rounded-control text-sm text-text-2 hover:text-text"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            App
          </Link>
          <BrandMark />
          <h1 className="font-mono text-base font-semibold tracking-wider">Component gallery</h1>
          <SimulatedDataBadge />
          <span className="text-xs text-text-2">Mock fixtures only — not engine output.</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <nav aria-label="Gallery sections">
            <ul className="flex flex-wrap gap-1 lg:flex-col">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="inline-flex min-h-target min-w-target items-center rounded-control px-2 text-sm text-text-2 hover:bg-surface-2 hover:text-text"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <section
            aria-labelledby="prefs-title"
            className="rounded-card border border-border bg-surface-1 p-3"
          >
            <h2 id="prefs-title" className="mb-2 text-xs font-semibold tracking-wider text-text-3 uppercase">
              Theme & glove mode
            </h2>
            <PreferencesControls />
          </section>
        </aside>
        <main className="flex min-w-0 flex-col gap-10">
          <StatusSection />
          <CardsSection />
          <ChartsSection />
          <ControlsSection />
          <StatesSection />
          <ShellSection />
        </main>
      </div>
    </div>
  );
}
