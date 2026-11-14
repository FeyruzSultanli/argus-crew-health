import { Inbox as InboxIcon } from 'lucide-react';

import type { ReplyRow } from '../../services/packets';
import { Card, EmptyState, Skeleton } from '../../ui';

const time = (iso: string): string => new Date(iso).toISOString().slice(11, 19) + ' UTC';

/** One message from Earth: free text shown exactly as written. */
export function ReplyItem({ reply }: { reply: ReplyRow }) {
  return (
    <li className="flex flex-col gap-1 rounded-control border border-border p-3" data-testid="reply-item">
      <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-2">
        <span className="font-medium text-text">{reply.author}</span>
        <span className="font-mono">
          sent {time(reply.sentAt)} · arrived {time(reply.deliveredAt ?? reply.deliverAt)}
        </span>
      </span>
      <p className="text-sm whitespace-pre-wrap text-text">{reply.body}</p>
    </li>
  );
}

/** Right column of /earth (doc 11 §5.7): replies from the flight surgeon that have arrived on board. */
export function Inbox({ replies }: { replies: ReplyRow[] | undefined }) {
  return (
    <Card title="Inbox from Earth" subtitle="Flight surgeon replies, after the one-way delay" data-testid="inbox">
      {replies === undefined ? (
        <Skeleton lines={3} label="Loading messages" />
      ) : replies.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="No messages from Earth yet"
          body="Replies arrive here after the one-way delay. A second browser tab signed in as Flight surgeon can answer delivered packets."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Messages from Earth">
          {replies.map((r) => (
            <ReplyItem key={r.id} reply={r} />
          ))}
        </ul>
      )}
    </Card>
  );
}
