// Wording of the face fluid-shift scan (docs/09 §2, docs/07 §4.12). Measurement language only: this is an index of
// facial geometry, not a health statement. No diagnosis, no advice; the only actions are retake / save.
export const TITLE = 'Face fluid-shift scan';
export const EXPERIMENTAL = 'Experimental — not validated';
export const PRIVACY_LINE = 'Video stays on this device. Only the number is saved.';
export const NO_IMAGE_LINE = 'No image is saved. Only the numbers are stored.';
export const REFERENCE_NAME = 'Reference scan (set on this device)';
export const REFERENCE_EXPLAINER =
  'No pre-flight scan exists in this demo. Your first scan is the reference; later scans are compared with it.';
export const TREND_ONLY = 'Trend only. This index never raises Watch or Act on its own.';
export const RULE_WORDING_NOTE =
  'The rule text says “pre-flight scans”; in this demo that means your reference scan on this device.';
export const REFERENCE_RESET_HELP =
  'The reference is kept on this device. “Reset reference” clears it; “Reset demo” clears it too, because it removes ' +
  'the saved reference scan from the record. Your next scan then becomes the new reference.';
export const REFERENCE_NEEDS_QUALITY = 'A reference scan needs fair or good quality. Please retake.';

/** How-to steps (docs/09 §2), ≤ 5. */
export const HOWTO_STEPS = [
  { id: 'distance', text: 'Face the camera straight on, at arm’s length.' },
  { id: 'light', text: 'Even light on your face, from the front.' },
  { id: 'neutral', text: 'Neutral face: mouth closed, no smile.' },
  { id: 'still', text: 'Hold still for 3 seconds while the scan runs.' },
] as const;

export const QUALITY_WORD = { good: 'Good quality', fair: 'Fair quality', poor: 'Poor quality' } as const;

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
  processing: { title: 'The scan stopped', body: 'Video frames could not be processed on this device.' },
  other: { title: 'The camera could not start', body: 'Try again.' },
};
