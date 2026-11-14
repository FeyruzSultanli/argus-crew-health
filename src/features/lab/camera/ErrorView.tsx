// Error state: camera denied / no camera / MediaPipe failed to load → clear message, retry, manual-entry pointer.
import { Keyboard } from 'lucide-react';

import { Button, ErrorState, LinkButton } from '../../../ui';
import { ERROR_TEXT } from './copy';
import type { SessionError } from './session';

export function ErrorView({ error, onRetry, onExit }: { error: SessionError; onRetry: () => void; onExit?: () => void }) {
  const text = ERROR_TEXT[error.kind] ?? (ERROR_TEXT.other as { title: string; body: string });
  return (
    <div className="flex flex-col gap-4">
      <ErrorState title={text.title} message={text.body} detail={error.message} onRetry={onRetry} />
      <div className="flex flex-wrap items-center gap-3">
        <LinkButton to="/lab/manual" icon={Keyboard}>
          Enter pulse manually instead
        </LinkButton>
        {onExit && <Button onClick={onExit}>Exit</Button>}
      </div>
    </div>
  );
}
