import { useSearchParams } from 'react-router';

import { useMissionStore } from '../../state/mission';
import { useUiStore } from '../../state/ui';
import type { GlucoseUnit, TempUnit } from '../../state/ui';
import { Card, LinkButton, PreferencesControls, SegmentedControl, Switch } from '../../ui';
import { CalibrationSettings } from './CalibrationSettings';
import { DemoControls } from './DemoControls';
import { ExportSlot } from './ExportSlot';
import { ResetDemo } from './ResetDemo';

const TEMP: ReadonlyArray<{ value: TempUnit; label: string }> = [
  { value: 'Cel', label: '°C' },
  { value: '[degF]', label: '°F' },
];
const GLUCOSE: ReadonlyArray<{ value: GlucoseUnit; label: string }> = [
  { value: 'mg/dL', label: 'mg/dL' },
  { value: 'mmol/L', label: 'mmol/L' },
];

function UnitsControls() {
  const units = useUiStore((s) => s.units);
  const setUnits = useUiStore((s) => s.setUnits);
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl<TempUnit>
        label="Temperature unit"
        options={TEMP}
        value={units.temp}
        onChange={(temp) => setUnits({ temp })}
        className="self-start"
      />
      <SegmentedControl<GlucoseUnit>
        label="Glucose unit"
        options={GLUCOSE}
        value={units.glucose}
        onChange={(glucose) => setUnits({ glucose })}
        className="self-start"
      />
      <p className="text-xs text-text-3">
        Values are stored in SI/UCUM units and converted only for display.
      </p>
    </div>
  );
}

/** Settings (doc 11 §5.9, FR-SET-1/2): display, units, calibration, export, demo controls and reset. */
export default function SettingsPage() {
  const [params] = useSearchParams();
  const visibleFlag = useMissionStore((s) => s.demo.controlsVisible);
  const setDemoFlags = useMissionStore((s) => s.setDemoFlags);
  const fromUrl = params.get('demo') === '1';
  const showDemo = visibleFlag || fromUrl;
  return (
    <div
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 lg:px-6"
      data-testid="settings-page"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-text">Settings</h1>
        <LinkButton to="/limits" variant="ghost">
          Limits and honesty
        </LinkButton>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Display">
          <div className="w-fit min-w-72">
            <PreferencesControls />
          </div>
          <p className="mt-4 text-sm text-text-2">
            Language: <span className="text-text">English (only language in this build)</span>
          </p>
        </Card>
        <Card title="Units">
          <UnitsControls />
        </Card>
        <Card title="Calibration" subtitle="Per device, stored in this browser">
          <CalibrationSettings />
        </Card>
        <Card title="Data export">
          <ExportSlot />
        </Card>
      </div>
      <Card title="Demo" subtitle="Simulated timeline">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Switch
            checked={showDemo}
            onChange={(on) => setDemoFlags({ controlsVisible: on })}
            label="Show demo controls"
            description={
              fromUrl ? 'Shown because the address has ?demo=1' : 'Also shown with ?demo=1 in the address'
            }
          />
          <ResetDemo />
        </div>
      </Card>
      {showDemo && <DemoControls />}
    </div>
  );
}
