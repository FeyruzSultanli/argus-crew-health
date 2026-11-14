import { CaughtOnlyByPersonal, StatusPill, VERDICT } from '../../ui';
import { LayerFlagLine } from './CrewCard';
import type { ReceivedCrewRow } from './crewOverview';

const dayLabel = (d: number): string => (d < 0 ? `L${d}` : `MD ${d}`);
const time = (iso: string): string => new Date(iso).toISOString().slice(11, 19) + ' UTC';

/** Flight surgeon (FR-CREW-2): one crew member as of the newest delivered packet that contains them. */
export function ReceivedCrewCard({ row }: { row: ReceivedCrewRow }) {
  const { summary, packet } = row;
  const caught = summary.flags.some((f) => f.caughtOnlyByPersonal);
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-5" data-testid={`crew-card-${row.crewId}`} data-verdict={row.verdict}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold text-text">{row.name}</span>
          <span className="font-mono text-xs text-text-3">
            As of {dayLabel(packet.request.toDay)} · packet received {time(packet.deliveredAt ?? packet.deliverAt)}
          </span>
        </span>
        <StatusPill verdict={row.verdict} />
      </div>
      <LayerFlagLine caption="Flags by driving layer" personal={row.byLayer.personal} space={row.byLayer.space} earth={row.byLayer.earth} />
      {caught && (
        <span>
          <CaughtOnlyByPersonal />
        </span>
      )}
      <ul className="flex flex-col gap-1 text-sm text-text" aria-label="Flags in the packet">
        {summary.flags.length === 0 ? (
          <li className="text-text-2">No flags in the packet</li>
        ) : (
          summary.flags.map((f) => (
            <li key={f.signalId}>
              {f.label} · {VERDICT[f.verdict].word}
            </li>
          ))
        )}
      </ul>
      <p className="text-xs text-text-2">
        {summary.readings} readings in the packet period · readiness and today&apos;s tasks stay on board (not part of the
        packet).
      </p>
    </li>
  );
}
