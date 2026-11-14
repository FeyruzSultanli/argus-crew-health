// Data export on the Settings page: FHIR-style JSON and CSV (the same buttons as on the Earth link screen).
import { ExportButtons } from '../earthlink/ExportButtons';

export function ExportSlot() {
  return (
    <div data-testid="export-slot">
      <ExportButtons />
    </div>
  );
}
