import { FileDown, FileJson } from 'lucide-react';
import { useState } from 'react';

import { useCrew } from '../../services/hooks';
import { exportCsv, exportFhir, type ExportFile } from '../../services/packets';
import { useMissionStore } from '../../state/mission';
import { useSessionStore } from '../../state/session';
import { Button, useToast } from '../../ui';
import { DEFAULT_PERIOD_DAYS, daysBefore } from './composerState';
import { downloadText } from './download';

export interface ExportButtonsProps {
  /** Crew to export; default: own data for a crew member, every crew member for the CMO. */
  crewIds?: readonly string[];
  /** Mission-day period; default: the last 7 days up to the selected mission day. */
  fromDay?: number;
  toDay?: number;
  className?: string;
}

/**
 * FR-DATA-2 export buttons: FHIR R4 Bundle (JSON) and CSV of observations, downloaded with Blob + object URL
 * (offline-safe). Drop-in for the Settings page. The flight surgeon has no on-board data: nothing to export here.
 */
export function ExportButtons({ crewIds, fromDay, toDay, className }: ExportButtonsProps) {
  const role = useSessionStore((s) => s.role);
  const ownId = useSessionStore((s) => s.crewId);
  const missionDay = useMissionStore((s) => s.missionDay);
  const crew = useCrew();
  const toast = useToast();
  const [busy, setBusy] = useState<'fhir' | 'csv' | null>(null);

  if (role === 'surgeon' || role === null) {
    return (
      <p className={className} data-testid="export-buttons">
        <span className="text-sm text-text-2">Exports cover on-board data. On Earth, download each received packet instead.</span>
      </p>
    );
  }
  const ids = crewIds ? [...crewIds] : role === 'crew' ? (ownId ? [ownId] : []) : (crew ?? []).map((c) => c.id);
  const to = toDay ?? missionDay;
  const from = fromDay ?? daysBefore(to, DEFAULT_PERIOD_DAYS - 1);

  const run = async (kind: 'fhir' | 'csv') => {
    setBusy(kind);
    try {
      const req = { crewIds: ids, fromDay: from, toDay: to };
      const file: ExportFile = kind === 'fhir' ? await exportFhir(req) : await exportCsv(req);
      downloadText(file.fileName, file.text, file.mime);
      toast.show({ title: `Exported ${file.fileName}`, body: `${file.count} observations.`, tone: 'info' });
    } catch (err: unknown) {
      toast.show({ title: 'Export failed', body: err instanceof Error ? err.message : String(err), tone: 'act' });
    } finally {
      setBusy(null);
    }
  };
  const disabled = busy !== null || ids.length === 0;
  return (
    <div className={className} data-testid="export-buttons">
      <div className="flex flex-wrap gap-2">
        <Button icon={FileJson} disabled={disabled} onClick={() => void run('fhir')} data-testid="export-fhir">
          {busy === 'fhir' ? 'Exporting…' : 'Export FHIR JSON'}
        </Button>
        <Button icon={FileDown} disabled={disabled} onClick={() => void run('csv')} data-testid="export-csv">
          {busy === 'csv' ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-text-2">
        {from < 0 ? `L${from}` : `MD ${from}`} to {to < 0 ? `L${to}` : `MD ${to}`} · {ids.length} crew member
        {ids.length === 1 ? '' : 's'} · FHIR R4 Bundle with LOINC / UCUM where available; data labels kept.
      </p>
    </div>
  );
}
