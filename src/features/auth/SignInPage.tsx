import { useLocation, useNavigate } from 'react-router';
import { Info } from 'lucide-react';

import { brand } from '../../config/brand';
import { BrandMark } from '../../ui/BrandMark';
import { SimulatedDataBadge } from '../../ui/shell/StatusBadges';
import { RolePicker } from './RolePicker';

/** /sign-in — demo role picker. Clearly a demo: no accounts, no passwords, data stays on this device. */
export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const target = from && from !== '/sign-in' ? from : '/';
  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 py-12 text-text">
      <main className="w-full max-w-3xl">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size={32} />
            <div>
              <p className="font-mono text-xl font-semibold tracking-widest">{brand.name}</p>
              <p className="text-sm text-text-2">{brand.tagline}</p>
            </div>
          </div>
          <SimulatedDataBadge />
        </div>
        {/* Product wording from docs/01 §2; describes what ARGUS does, no numbers, no advice. */}
        <p className="mb-8 max-w-prose text-base text-text-2" data-testid="three-layer-line">
          Every health reading is judged against your own baseline, space-adapted NASA evidence and Earth
          reference ranges.
        </p>
        <section
          className="rounded-card border border-border bg-surface-1 p-6"
          aria-labelledby="signin-title"
        >
          <h1 id="signin-title" className="text-2xl font-semibold">
            Choose who you are
          </h1>
          <p className="mt-2 mb-6 flex items-start gap-2 rounded-control border border-border bg-surface-2 p-3 text-sm text-text-2">
            <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            Demo sign-in. There are no accounts and nothing leaves this device; the PIN only makes the choice
            deliberate. The crew are fictional and their data is simulated.
          </p>
          <RolePicker onSignedIn={() => navigate(target, { replace: true })} />
        </section>
      </main>
    </div>
  );
}
