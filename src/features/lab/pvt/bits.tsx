// Small presentational pieces of the Reaction Self-Test.
import { FlaskConical } from 'lucide-react';

import type { PvtScriptProfile } from '../../../measurement/pvt';
import { Badge } from '../../../ui/Badge';

export const TEST_MODE_TEXT = 'TEST MODE — scripted responses';

export function TestModeBadge({ profile }: { profile: PvtScriptProfile }) {
  return (
    <Badge tone="watch" icon={FlaskConical} data-testid="pvt-test-mode" className="h-8 border-2 px-3 font-mono text-sm font-semibold">
      {TEST_MODE_TEXT} ({profile})
    </Badge>
  );
}
