// /handbook/<protocolId>: protocol header + runner.
import { ArrowLeft, ListChecks } from 'lucide-react';

import { getProtocol } from './content';
import type { ProtocolId } from '../../domain/types';
import { LinkButton } from '../../ui';
import { ProtocolRunner } from './ProtocolRunner';

export function ProtocolView({ id }: { id: ProtocolId }) {
  const protocol = getProtocol(id);
  return (
    <div
      className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-6 lg:px-6"
      data-testid="protocol-view"
    >
      <header className="flex flex-col gap-2">
        <LinkButton to="/handbook?category=protocols" variant="ghost" icon={ArrowLeft} className="self-start">
          Handbook: Protocols
        </LinkButton>
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-text">
          <ListChecks size={24} aria-hidden="true" className="text-text-2" />
          {protocol.title}
        </h1>
        <p className="max-w-[72ch] text-text-2">{protocol.summary}</p>
      </header>
      <ProtocolRunner key={protocol.id} protocol={protocol} />
    </div>
  );
}
