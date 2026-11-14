// Reproducible copy of the MediaPipe Tasks Vision WASM runtime into public/mediapipe/ (doc 09 §1).
// The copied files are committed so offline builds work; this script is NOT hooked into predev/prebuild.
// Run manually after upgrading @mediapipe/tasks-vision:  npx tsx scripts/copy-mediapipe.ts
// The model public/mediapipe/face_landmarker.task is not in the npm package. It was downloaded once from
// https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
// and committed; this script only reports whether it is present.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dest = join(root, 'public', 'mediapipe');

mkdirSync(dest, { recursive: true });
for (const name of readdirSync(src)) {
  copyFileSync(join(src, name), join(dest, name));
  console.log(`copied ${name} (${statSync(join(dest, name)).size} bytes)`);
}
const model = join(dest, 'face_landmarker.task');
console.log(
  existsSync(model)
    ? `model present: face_landmarker.task (${statSync(model).size} bytes)`
    : 'model MISSING: download face_landmarker.task (see header comment)',
);
