// A protocol step's tag: "Source: <badge + title>" or "Demo wording" (doc 07 §5).
import type { ProtocolStep } from './content';
import { SourceBadge, getSource } from '../../ui';
import { DemoWordingTag } from './Markdown';

export function StepTag({ step }: { step: ProtocolStep }) {
  if (step.tag === 'demo wording' || step.sourceIds.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-2" data-testid="step-tag">
        <DemoWordingTag />
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-text-2" data-testid="step-tag">
      Source:
      {step.sourceIds.map((id) => (
        <span key={id} className="inline-flex items-center gap-2">
          <SourceBadge sourceIds={[id]} title={getSource(id)?.title} />
          <span className="text-text">{getSource(id)?.title ?? id}</span>
        </span>
      ))}
    </p>
  );
}
