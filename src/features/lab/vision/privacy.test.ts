// Code-level privacy check for the vision check (docs/PROJECT_RULES.md rule 7), same rules as the camera pulse
// (src/features/lab/camera/privacy.test.ts): the distance-estimate camera file and the vision engines never encode,
// store or send frames. Storage of the derived Amsler map lives in services/visionMaps.ts, not here.
import { describe, expect, it } from 'vitest';

const all = import.meta.glob(['./CameraDistance.tsx', '../../../measurement/vision/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const sources = Object.fromEntries(Object.entries(all).filter(([p]) => !p.includes('.test.')));

const FORBIDDEN: Array<[string, RegExp]> = [
  ['canvas encoding', /\b(toDataURL|toBlob|convertToBlob|transferToImageBitmap|getImageData)\b/],
  ['network', /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/],
  ['storage', /\b(indexedDB|localStorage|sessionStorage|caches|dexie|Dexie)\b/],
  ['recording', /\b(MediaRecorder|captureStream)\b/],
];

const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('vision camera privacy', () => {
  it('scans the expected files', () => {
    const names = Object.keys(sources).map((p) => p.split('/').pop());
    for (const f of ['CameraDistance.tsx', 'distance.ts', 'amsler.ts', 'acuity.ts']) expect(names).toContain(f);
  });
  for (const [what, re] of FORBIDDEN) {
    it(`no ${what} API`, () => {
      expect(Object.entries(sources).filter(([, src]) => re.test(strip(src))).map(([p]) => p)).toEqual([]);
    });
  }
  it('shows the camera-pulse privacy line', () => {
    expect(sources['./CameraDistance.tsx']).toContain('Video stays on this device. Only the number is saved.');
  });
});
