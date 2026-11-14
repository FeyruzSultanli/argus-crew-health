// "Measuring: <name>" chip shown by every Lab flow (doc 09 intro).
import { User } from 'lucide-react';

import { Badge } from '../../ui/Badge';

export function SubjectChip({ name }: { name: string }) {
  return (
    <Badge tone="info" icon={User} className="h-8 px-3 text-sm">
      <span>
        Measuring: <strong className="font-semibold text-text">{name}</strong>
      </span>
    </Badge>
  );
}
