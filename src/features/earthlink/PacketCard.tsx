import { CircleCheck, Clock, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { EARTH_LINK_SOURCE_IDS, arrivalText, formatDuration, statusAt, type PacketRow, type PacketStatus } from '../../services/packets';
import { Badge, Countdown, SourceBadge, cx } from '../../ui';
import { DelayValue } from './LinkStatus';
import { PacketSize } from './PacketPreview';

const STEPS: ReadonlyArray<{ id: PacketStatus; label: string; icon: LucideIcon }> = [
  { id: 'queued', label: 'Queued', icon: Clock },
  { id: 'in-transit', label: 'In transit', icon: Send },
  { id: 'delivered', label: 'Delivered', icon: CircleCheck },
];

const dayLabel = (d: number): string => (d < 0 ? `L${d}` : `MD ${d}`);
const time = (iso: string): string => new Date(iso).toISOString().slice(11, 19) + ' UTC';

/** Queued → In transit → Delivered, shown as text + icon (never colour alone). */
export function StatusSteps({ status }: { status: PacketStatus }) {
  const at = STEPS.findIndex((s) => s.id === status);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Delivery status">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const state = i < at ? 'done' : i === at ? 'current' : 'todo';
        return (
          <li
            key={s.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs',
              state === 'current' ? 'border-brand font-semibold text-text' : 'border-border text-text-3',
            )}
          >
            <Icon size={14} aria-hidden="true" />
            {s.label}
            {state === 'done' && <span className="sr-only"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** One sent packet (doc 11 §5.7): state, arrival copy with demo compression, countdown. */
export function PacketCard({ packet, now }: { packet: PacketRow; now: number }) {
  // The stored state is written by the clock; until then derive it from the times (reload-safe).
  const status = packet.status === 'delivered' ? 'delivered' : statusAt(packet, now);
  const names = packet.digest.map((c) => c.name).join(', ');
  const r = packet.request;
  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4" data-testid="packet-card" data-status={status} aria-label={`Packet for ${names}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">
            {names} · {dayLabel(r.fromDay)} to {dayLabel(r.toDay)} · {r.flagsOnly ? 'flags only' : 'all readings'}
          </h3>
          <p className="font-mono text-xs text-text-3">
            Sent {time(packet.createdAt)} · {packet.profileLabel} · <PacketSize bytes={packet.sizeBytes} />
          </p>
        </div>
        <StatusSteps status={status} />
      </header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 text-sm text-text">
            <span data-testid="packet-arrival">{arrivalText(packet.delaySec, packet.compression)}</span>
            <SourceBadge sourceIds={EARTH_LINK_SOURCE_IDS} title="Comms delay and demo time compression" />
            {packet.compression !== 1 && (
              <Badge tone="neutral" variant="outline">
                Demo parameter
              </Badge>
            )}
          </p>
          <span className="flex flex-wrap items-center gap-2 text-xs text-text-2">
            One-way delay <DelayValue delaySec={packet.delaySec} modeled={packet.modeledDelay} size="sm" />
          </span>
        </div>
        {status === 'delivered' ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-text" data-testid="packet-delivered">
            <CircleCheck size={16} aria-hidden="true" className="text-ok" />
            Delivered to the flight surgeon at {time(packet.deliveredAt ?? packet.deliverAt)}
          </p>
        ) : (
          <Countdown
            endsAt={Date.parse(packet.deliverAt)}
            startedAt={Date.parse(packet.createdAt)}
            label="Packet delivery"
            note={`${formatDuration(packet.delaySec)} (shown as ${formatDuration(packet.delaySec / packet.compression)})`}
          />
        )}
      </div>
    </article>
  );
}
