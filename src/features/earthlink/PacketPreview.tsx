import { useState } from 'react';

import { periodLength } from '../../domain/fhir';
import { EARTH_LINK_SOURCE_IDS } from '../../services/packets';
import { ErrorState, Skeleton, Value } from '../../ui';
import { composerProblems, toRequest, type ComposerState } from './composerState';
import { usePacketPreview } from './hooks';
import { SummaryView } from './SummaryView';
import { useMissionStore } from '../../state/mission';

/** Packet size through <Value> (bytes of the serialised bundle, shown in kB = 1000 bytes). */
export function PacketSize({ bytes }: { bytes: number }) {
  return (
    <Value value={bytes / 1000} unit="kB" precision={1} sourceIds={EARTH_LINK_SOURCE_IDS} size="sm" title="Packet size (serialised FHIR bundle)" />
  );
}

/** Collapsible FHIR JSON (a <details> element: keyboard and screen-reader friendly). */
export function FhirJsonPreview({ bundle, id }: { bundle: unknown; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded-control border border-border"
      data-testid={`fhir-json-${id}`}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex min-h-target cursor-pointer items-center px-3 text-sm font-medium text-text">FHIR JSON preview</summary>
      {/* Only rendered while open: an empty focusable scroll box in the closed <details> was an invisible 25-px tab stop. */}
      {open && (
        <pre className="max-h-80 overflow-auto border-t border-border p-3 font-mono text-xs text-text-2" tabIndex={0} aria-label="FHIR bundle JSON">
          {JSON.stringify(bundle, null, 2)}
        </pre>
      )}
    </details>
  );
}

/** Live preview of what would be sent: human summary, size, FHIR JSON. */
export function PacketPreview({ state }: { state: ComposerState }) {
  const missionDay = useMissionStore((s) => s.missionDay);
  const ok = composerProblems(state, missionDay).length === 0;
  const preview = usePacketPreview(ok ? toRequest(state) : null);
  if (!ok) return null;
  if (preview.error) return <ErrorState title="Preview failed" message={preview.error} />;
  const c = preview.composed;
  if (!c) return <Skeleton lines={4} label="Building the packet preview" />;
  const patients = c.bundle.entry.filter((e) => e.resource.resourceType === 'Patient').length;
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-bg p-4" aria-label="Packet preview" aria-busy={preview.loading} data-testid="packet-preview">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-2">
        <span className="font-medium text-text">Preview</span>
        <span className="inline-flex items-center gap-1.5">
          Size <PacketSize bytes={c.sizeBytes} />
        </span>
        <span>
          {c.observations.length} Observation{c.observations.length === 1 ? '' : 's'} · {patients} Patient{patients === 1 ? '' : 's'} (fictional)
        </span>
      </div>
      <SummaryView crews={c.summary.crews} periodDays={periodLength(state.fromDay, state.toDay)} />
      <FhirJsonPreview bundle={c.bundle} id="preview" />
    </section>
  );
}
