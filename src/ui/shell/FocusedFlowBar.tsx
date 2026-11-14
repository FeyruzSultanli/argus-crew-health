import { useNavigate } from 'react-router';
import { X } from 'lucide-react';

import type { FocusedFlow } from '../../state/ui';
import { BrandMark } from '../BrandMark';
import { Button } from '../Button';
import { SimulatedDataBadge } from './StatusBadges';

/** Thin header for focused Lab flows (doc 11 §5.4): mark, flow title, honesty badge, "Exit". */
export function FocusedFlowBar({ flow, onExit }: { flow: FocusedFlow; onExit?: () => void }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex min-h-12 items-center gap-3 border-b border-border bg-surface-1 px-3">
      <BrandMark size={20} />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-text">{flow.title}</p>
      <SimulatedDataBadge />
      <Button
        variant="secondary"
        icon={X}
        onClick={() => {
          onExit?.();
          navigate(flow.exitTo);
        }}
      >
        Exit
      </Button>
    </header>
  );
}
