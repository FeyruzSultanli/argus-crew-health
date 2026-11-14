import { useParams } from 'react-router';

import { HandbookEntryView } from './HandbookEntryView';
import { HandbookIndex } from './HandbookIndex';
import { ProtocolView } from './ProtocolView';
import { resolveHandbookParam } from './handbookFilter';

/**
 * /handbook → index (search + categories, `?category=protocols` opens the Protocols list);
 * /handbook/<protocolId> or /handbook/protocol-<id> → the protocol runner; /handbook/<entryId> → the entry.
 */
export default function HandbookPage() {
  const { entry } = useParams();
  if (!entry) return <HandbookIndex />;
  const target = resolveHandbookParam(entry);
  if (target.kind === 'protocol') return <ProtocolView key={target.id} id={target.id} />;
  return <HandbookEntryView key={target.id} id={target.id} />;
}
