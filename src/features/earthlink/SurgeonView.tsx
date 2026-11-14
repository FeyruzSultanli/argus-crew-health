import { Download, Reply, Satellite } from 'lucide-react';
import { useState } from 'react';

import { periodLength } from '../../domain/fhir';
import { useDeliveredPackets, useSentReplies } from '../../services/hooks';
import { arrivalText, sendReply, type PacketRow, type ReplyRow } from '../../services/packets';
import { useMissionStore } from '../../state/mission';
import { Button, Card, Countdown, EmptyState, Skeleton, useToast } from '../../ui';
import { downloadText } from './download';
import { useNow } from './hooks';
import { DelayValue } from './LinkStatus';
import { FhirJsonPreview, PacketSize } from './PacketPreview';
import { StatusSteps } from './PacketCard';
import { SummaryView } from './SummaryView';

const dayLabel = (d: number): string => (d < 0 ? `L${d}` : `MD ${d}`);
const time = (iso: string): string => new Date(iso).toISOString().slice(11, 19) + ' UTC';

function ReplyForm({ packet }: { packet: PacketRow }) {
  const missionDay = useMissionStore((s) => s.missionDay);
  const toast = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const id = `reply-${packet.id}`;
  const send = async () => {
    setBusy(true);
    try {
      // Same compressed delay as the packet it answers.
      await sendReply({ body, inReplyTo: packet.id, missionDay }, { compression: packet.compression });
      setBody('');
      toast.show({ title: 'Reply on its way to the crew', tone: 'info' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text">
        Reply to the crew (sent as written)
      </label>
      <textarea
        id={id}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-target rounded-control border border-border-strong bg-bg px-3 py-2 text-base text-text focus-visible:outline-2 focus-visible:outline-brand"
      />
      <div>
        <Button icon={Reply} disabled={busy || !body.trim()} onClick={() => void send()} data-testid="send-reply">
          Send reply
        </Button>
      </div>
    </div>
  );
}

function ReceivedPacket({ packet }: { packet: PacketRow }) {
  const names = packet.digest.map((c) => c.name).join(', ');
  const r = packet.request;
  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4" data-testid="received-packet" aria-label={`Packet from ${names}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text">
            {names} · {dayLabel(r.fromDay)} to {dayLabel(r.toDay)} · {r.flagsOnly ? 'flags only' : 'all readings'}
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-text-3">
            Sent {time(packet.createdAt)} · received {time(packet.deliveredAt ?? packet.deliverAt)} · {packet.profileLabel} ·{' '}
            <PacketSize bytes={packet.sizeBytes} />
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-2" data-testid="provenance">
            Provenance: simulated Earth link (time-compressed); one-way delay{' '}
            <DelayValue delaySec={packet.delaySec} modeled={packet.modeledDelay} size="sm" />
          </p>
        </div>
        <StatusSteps status="delivered" />
      </header>
      <SummaryView crews={packet.digest} periodDays={periodLength(r.fromDay, r.toDay)} />
      {r.note && (
        <p className="text-sm whitespace-pre-wrap text-text">
          <span className="text-text-2">Note from the crew (as written): </span>
          {r.note}
        </p>
      )}
      <FhirJsonPreview bundle={packet.bundle} id={packet.id} />
      <div>
        <Button
          icon={Download}
          variant="ghost"
          onClick={() => downloadText(`argus-packet-${packet.profileId}-${dayLabel(r.toDay).replace(' ', '')}.json`, JSON.stringify(packet.bundle, null, 2), 'application/fhir+json')}
        >
          Download FHIR JSON
        </Button>
      </div>
      <ReplyForm packet={packet} />
    </article>
  );
}

function SentReply({ reply, now }: { reply: ReplyRow; now: number }) {
  const delivered = reply.status === 'delivered' || now >= Date.parse(reply.deliverAt);
  return (
    <li className="flex flex-col gap-2 rounded-control border border-border p-3" data-testid="sent-reply" data-status={delivered ? 'delivered' : 'in-transit'}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <StatusSteps status={delivered ? 'delivered' : 'in-transit'} />
        <span className="text-xs text-text-2">{arrivalText(reply.delaySec, reply.compression)}</span>
      </span>
      <p className="text-sm whitespace-pre-wrap text-text">{reply.body}</p>
      {!delivered && <Countdown endsAt={Date.parse(reply.deliverAt)} startedAt={Date.parse(reply.sentAt)} label="Reply delivery" />}
    </li>
  );
}

/** Flight surgeon view of /earth (FR-CREW-2): only packets that have been delivered; replies travel back delayed. */
export function SurgeonEarthLink() {
  const now = useNow(250);
  const packets = useDeliveredPackets();
  const replies = useSentReplies();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card title="Received packets" subtitle="Only packets that have arrived on Earth are shown" data-testid="received-packets">
        {packets === undefined ? (
          <Skeleton lines={4} label="Loading received packets" />
        ) : packets.length === 0 ? (
          <EmptyState icon={Satellite} title="No packet has arrived yet" body="Packets in transit appear here once the one-way delay has passed." />
        ) : (
          <div className="flex flex-col gap-4">
            {packets.map((p) => (
              <ReceivedPacket key={p.id} packet={p} />
            ))}
          </div>
        )}
      </Card>
      <Card title="Replies sent" subtitle="On their way to the crew, with the same delay" data-testid="sent-replies">
        {replies === undefined ? (
          <Skeleton lines={3} label="Loading replies" />
        ) : replies.length === 0 ? (
          <EmptyState icon={Reply} title="No replies sent" body="Answer a received packet to send a message back to the crew." />
        ) : (
          <ul className="flex flex-col gap-2">
            {replies.map((r) => (
              <SentReply key={r.id} reply={r} now={now} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
