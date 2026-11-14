// Runtime list of the ProtocolId union (doc 06 §1a), in doc 07 §5 table order. The Record type makes the compiler
// reject a missing or extra id if the contract type changes.
import type { ProtocolId } from '../../../domain/types';

export const PROTOCOL_ORDER: Record<ProtocolId, number> = {
  'suspected-infection': 1,
  'spe-shelter': 2,
  'co2-headache': 3,
  'vision-change': 4,
  'sleep-debt': 5,
};

export const PROTOCOL_IDS: readonly ProtocolId[] = (Object.keys(PROTOCOL_ORDER) as ProtocolId[]).sort(
  (a, b) => PROTOCOL_ORDER[a] - PROTOCOL_ORDER[b],
);

export function isProtocolId(x: unknown): x is ProtocolId {
  return typeof x === 'string' && Object.hasOwn(PROTOCOL_ORDER, x);
}
