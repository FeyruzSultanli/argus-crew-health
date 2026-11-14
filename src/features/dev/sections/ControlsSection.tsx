import { useState } from 'react';
import { Crosshair, Layers, Orbit, Send, Trash2, UserRound, Globe2 } from 'lucide-react';

import { useUiStore } from '../../../state/ui';
import type { LayerLens } from '../../../state/ui';
import { Button } from '../../../ui/Button';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { Sheet } from '../../../ui/Sheet';
import { SourceDrawer } from '../../../ui/SourceDrawer';
import { Switch } from '../../../ui/Switch';
import { Tabs } from '../../../ui/Tabs';
import { Demo, GallerySection } from './GallerySection';

const LENS = [
  { value: 'combined', label: 'Combined', icon: Layers },
  { value: 'personal', label: 'Personal', icon: UserRound },
  { value: 'space', label: 'Space', icon: Orbit },
  { value: 'earth', label: 'Earth', icon: Globe2 },
] as const;

export function ControlsSection() {
  const lens = useUiStore((s) => s.layerLens);
  const setLens = useUiStore((s) => s.setLayerLens);
  const [tab, setTab] = useState<'6h' | '1d' | '3d' | '7d'>('1d');
  const [sheet, setSheet] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [on, setOn] = useState(true);
  return (
    <GallerySection id="controls" title="Controls">
      <Demo
        name="Button"
        note="≥ 44 px (56 px in glove mode). Variants primary / secondary / ghost / danger; icon-only keeps a name."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={Crosshair}>
            Measure now
          </Button>
          <Button icon={Send}>Send to Earth</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger" icon={Trash2}>
            Reset demo
          </Button>
          <Button iconOnly icon={Crosshair}>
            Measure now
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Demo>
      <Demo name="SegmentedControl" note="Layer lens, wired to useUiStore.layerLens. Arrow keys move.">
        <SegmentedControl<LayerLens> label="Layer lens" options={LENS} value={lens} onChange={setLens} />
        <p className="mt-2 font-mono text-xs text-text-2">layerLens = {lens}</p>
      </Demo>
      <Demo name="Tabs" note="WAI-ARIA tabs; ←/→, Home/End.">
        <Tabs
          label="Flux window"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: '6h', label: '6 h', content: <p className="text-sm text-text-2">Six-hour window.</p> },
            { id: '1d', label: '1 d', content: <p className="text-sm text-text-2">One-day window.</p> },
            { id: '3d', label: '3 d', content: <p className="text-sm text-text-2">Three-day window.</p> },
            { id: '7d', label: '7 d', content: <p className="text-sm text-text-2">Seven-day window.</p> },
          ]}
        />
      </Demo>
      <Demo name="Switch">
        <div className="max-w-sm">
          <Switch checked={on} onChange={setOn} label="Include flags only" description="Packet contents" />
        </div>
      </Demo>
      <Demo name="Sheet & SourceDrawer" note="Focus moves in, Tab is trapped, Escape closes, focus returns.">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSheet(true)}>Open sheet</Button>
          <Button onClick={() => setDrawer(true)}>Open source drawer</Button>
        </div>
        <Sheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="Example sheet"
          description="Right-side sheet, 420 px."
          footer={<Button onClick={() => setSheet(false)}>Done</Button>}
        >
          <p className="text-sm text-text-2">Sheets hold pickers, drawers and detail views.</p>
        </Sheet>
        <SourceDrawer
          open={drawer}
          onClose={() => setDrawer(false)}
          title="Cabin CO₂"
          sourceIds={['SRC_STD3001_CO2', 'SRC_OSHA_CO2', 'SRC_DEMO_RULE_BANDS', 'unregistered-example-id']}
        />
      </Demo>
    </GallerySection>
  );
}
