// Protocols (FR-HELP-3) from seed/protocols.json — imported statically (doc 05 §8) and validated at module load.
import protocolsJson from '../../../../seed/protocols.json';
import type { ProtocolId } from '../../../domain/types';
import type { Protocol } from './types';
import { validateProtocols } from './validate';

/** The five protocols of doc 07 §5, in table order. Throws at import time if the JSON is malformed. */
export const protocols: readonly Protocol[] = validateProtocols(protocolsJson).protocols;

const byId = new Map<ProtocolId, Protocol>(protocols.map((p) => [p.id, p]));

export function getProtocol(id: ProtocolId): Protocol {
  const p = byId.get(id);
  if (!p) throw new Error(`unknown protocol "${id}"`);
  return p;
}

export { protocolSourceIds } from './renderProtocol';
