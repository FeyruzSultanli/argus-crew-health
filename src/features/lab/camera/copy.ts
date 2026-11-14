// Wording of the camera-pulse flow (doc 09 §1.4). No diagnosis, no clinical advice: the result is the number and
// its quality; the only action offered is to retake.
import type { Quality } from '../../../domain/types';

export const PRIVACY_LINE = 'Video stays on this device. Only the number is saved.';

/** How-to steps (doc 09 §1.4 step 1), ≤ 5. */
export const HOWTO_STEPS = [
  { id: 'still', text: 'Sit still and face the screen. Rest your arms, keep your head level.' },
  { id: 'light', text: 'Even light on your face, from the front. No bright window or lamp behind you.' },
  { id: 'time', text: 'Hold still for 30 seconds. The timer counts down; the number settles after 10 seconds.' },
  { id: 'breathe', text: 'Breathe normally and do not talk during the measurement.' },
] as const;

export const QUALITY_WORD: Record<Quality['label'], string> = {
  good: 'Good quality',
  fair: 'Fair quality',
  poor: 'Poor quality',
};

export const CHECK_NAMES = {
  snr: 'Pulse signal strength (SNR)',
  consistency: 'Consistency, first vs last 15 s',
  motion: 'Head movement',
  lighting: 'Lighting',
  face: 'Face found',
} as const;

export const ERROR_TEXT: Record<string, { title: string; body: string }> = {
  denied: {
    title: 'Camera access is blocked',
    body: 'Allow the camera for this site in the browser settings (the camera icon in the address bar), then try again.',
  },
  'no-camera': { title: 'No camera found', body: 'Connect a camera or use a device with a front camera, then try again.' },
  busy: { title: 'The camera is busy', body: 'Close other apps or tabs that use the camera, then try again.' },
  insecure: {
    title: 'The camera needs a secure page',
    body: 'Open ARGUS over https or on localhost; browsers block the camera on plain http.',
  },
  unsupported: { title: 'Camera not available', body: 'This browser does not offer camera access.' },
  tracker: {
    title: 'The face tracker could not load',
    body: 'The MediaPipe face model did not start. Reload the page once while online so it is cached, then try again.',
  },
  processing: { title: 'The measurement stopped', body: 'Video frames could not be processed on this device.' },
  other: { title: 'The camera could not start', body: 'Try again. If it keeps failing, enter the pulse manually.' },
};
