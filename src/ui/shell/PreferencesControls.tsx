import { Contrast, Moon, Sun } from 'lucide-react';

import { useUiStore } from '../../state/ui';
import type { Theme } from '../../state/ui';
import { SegmentedControl } from '../SegmentedControl';
import { Switch } from '../Switch';

const THEMES = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'hc', label: 'High contrast', icon: Contrast },
] as const satisfies ReadonlyArray<{ value: Theme; label: string; icon: typeof Moon }>;

/** Theme, glove mode and reduced motion — switch live (FR-SET-1). Used in the user menu and on /dev/ui. */
export function PreferencesControls() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const glove = useUiStore((s) => s.gloveMode);
  const setGlove = useUiStore((s) => s.setGloveMode);
  const reduced = useUiStore((s) => s.reducedMotion);
  const setReduced = useUiStore((s) => s.setReducedMotion);
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl<Theme>
        label="Theme"
        options={THEMES.map((t) => ({ ...t, iconOnly: true }))}
        value={theme}
        onChange={setTheme}
      />
      <Switch checked={glove} onChange={setGlove} label="Glove mode" description="Larger targets and text" />
      <Switch
        checked={reduced}
        onChange={setReduced}
        label="Reduce motion"
        description="Also follows your system setting"
      />
    </div>
  );
}
