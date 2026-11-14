import { ShieldAlert } from 'lucide-react';

import { limits } from '../handbook/content';
import { Card, SourceBadge } from '../../ui';
import { CREDITS, CREDITS_MARK_NOTE } from './credits';
import { LimitsTable } from './LimitsTable';
import { RppgValidation } from './RppgValidation';

function Credits() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" data-testid="credits-table">
        <caption className="sr-only">Credits and licenses (from CREDITS.md)</caption>
        <thead>
          <tr className="border-b border-border-strong text-xs text-text-2">
            <th scope="col" className="py-2 pr-4 font-medium">
              Asset
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Source
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              License
            </th>
            <th scope="col" className="py-2 font-medium">
              Where used
            </th>
          </tr>
        </thead>
        <tbody>
          {CREDITS.map((c) => (
            <tr key={c.asset} className="border-b border-border align-top">
              <th scope="row" className="py-2 pr-4 font-medium text-text">
                {c.asset}
              </th>
              <td className="max-w-[48ch] py-2 pr-4 break-words text-text-2">{c.source}</td>
              <td className="py-2 pr-4 font-mono text-xs text-text">{c.license}</td>
              <td className="py-2 font-mono text-xs break-words text-text-2">{c.whereUsed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Limits & honesty page (FR-SET-3, doc 11 §5.9, doc 14 §4). Never cut. All content comes from seed/limits.json. */
export default function LimitsPage() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 lg:px-6"
      data-testid="limits-page"
    >
      <header>
        <h1 className="text-2xl font-semibold text-text">Limits</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-text-2">
          What this prototype is and is not: which data is real, measured, simulated, modeled, a demo choice
          or experimental.
        </p>
      </header>

      <Card title="Not a medical device" data-testid="not-medical-device">
        <p className="flex items-start gap-3 text-sm text-text">
          <ShieldAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-text-2" />
          <span>{limits.notMedicalDevice}</span>
        </p>
        <h3 className="mt-4 text-sm font-semibold text-text">Non-goals</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-2">
          {limits.nonGoals.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </Card>

      <Card title="Real, simulated, modeled, experimental">
        <LimitsTable content={limits} />
      </Card>

      <Card title="Camera pulse validation" subtitle="rPPG vs a reference device">
        <RppgValidation placeholder={limits.rppgValidation.placeholder} />
      </Card>

      <Card title="Known gaps">
        <ul className="flex flex-col divide-y divide-border">
          {limits.knownGaps.map((g) => (
            <li key={g.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">{g.label}</p>
                <p className="mt-0.5 max-w-[72ch] text-sm text-text-2">{g.detail}</p>
              </div>
              {g.sourceIds.length > 0 && <SourceBadge sourceIds={g.sourceIds} title={g.label} />}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Credits">
        <Credits />
        <p className="mt-4 text-sm text-text-2">{CREDITS_MARK_NOTE}</p>
        <p className="mt-1 text-sm text-text-2">
          No NASA logos or insignia are used; the ARGUS mark is our own.
        </p>
      </Card>
    </div>
  );
}
