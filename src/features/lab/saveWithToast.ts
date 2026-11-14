// Save through the health service and confirm with a toast; errors propagate to the flow, which shows them.
import type { NewObservation, Observation } from '../../domain/types';
import { healthService } from '../../services/healthService';
import type { ToastApi } from '../../ui/toastContext';

export async function saveObservation(o: NewObservation): Promise<Observation> {
  return healthService.addObservation(o);
}

export function toastSaved(toast: ToastApi, what: string, crewName: string): void {
  toast.show({ title: 'Saved', body: `${what} saved for ${crewName}.`, tone: 'ok' });
}
