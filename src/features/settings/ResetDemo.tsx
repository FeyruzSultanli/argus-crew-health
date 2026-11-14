// "Reset demo" (FR-SET-2): confirm dialog → resetDemoAndStores() → toast.
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

import { resetDemoAndStores } from '../../services/boot';
import { Button, Sheet, useToast } from '../../ui';

export function ResetDemo() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const confirm = async () => {
    setBusy(true);
    try {
      await resetDemoAndStores();
      setOpen(false);
      toast.show({
        title: 'Demo reset',
        body: 'The simulated timeline was re-seeded; the mission day is back to today.',
        tone: 'ok',
      });
    } catch (err) {
      console.warn('reset demo failed', err);
      toast.show({
        title: 'Reset failed',
        body: 'The demo data could not be re-seeded. Try again.',
        tone: 'act',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="danger" icon={RotateCcw} onClick={() => setOpen(true)} data-testid="reset-demo">
        Reset demo
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        title="Reset the demo?"
        description="This re-seeds the simulated crew timeline and removes your own measurements, check-ins and messages on this device. Preferences stay."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirm()}
              disabled={busy}
              data-testid="reset-confirm"
            >
              {busy ? 'Resetting' : 'Reset demo'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-2">
          The mission profile stays the same; the mission day goes back to today.
        </p>
      </Sheet>
    </>
  );
}
