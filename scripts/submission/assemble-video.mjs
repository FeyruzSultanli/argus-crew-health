// Assemble the 29-s demo video from the recorded shots (raw/*.webm + raw/marks.json, see record-video.mjs).
// Output in docs/submission/video/:
//   ARGUS-video-draft.mp4      VIDEO_SCRIPT.md order; shot 2 = video/shot-camera.mp4 if present, else a slate
//                              "CAMERA SHOT — record with a real face …" (so the draft cannot be submitted by mistake)
//   ARGUS-video-nocamera.mp4   complete cut without a pulse measurement (camera explainer 2 s + test-mode PVT 5 s)
//   captions.srt / captions-nocamera.srt
// H.264, 1920×1080, 30 fps, yuv420p, no audio. Captions are rendered as PNGs (IBM Plex Sans) and burned in.
// Team name for the end card: docs/submission/slides/deck.config.json (teamName).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VIDEO = join(ROOT, 'docs', 'submission', 'video');
const RAW = join(VIDEO, 'raw');
const WORK = join(RAW, 'work');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE ?? 'ffprobe';
const FPS = 30;
const MAX_TOTAL = 29.5;
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const marks = JSON.parse(readFileSync(join(RAW, 'marks.json'), 'utf8'));
const deck = JSON.parse(readFileSync(join(ROOT, 'docs', 'submission', 'slides', 'deck.config.json'), 'utf8'));
const team = deck.teamName;

// Captions exactly as docs/submission/VIDEO_SCRIPT.md (≤ 12 words each); NC2 is the no-camera replacement.
const CAP = {
  c1a: 'Mars transit, day 143. Earth is 11 minutes away (modeled).',
  c1b: 'Normal for Earth and space rules. Caught only by her baseline.',
  c2: 'Re-checked with the laptop camera: real pulse, quality scored, sped up.',
  c3: 'Reaction Self-Test, 3 minutes (scripted test run shown).',
  c4: 'Solar storm replay (synthetic): shelter advised, every crew dose tracked.',
  c5: 'Crew acts now. The flight surgeon gets the packet 11 minutes later.',
  c6: 'ARGUS. Personal. Space. Earth. Decisions on board.',
  nc2: 'Laptop-camera pulse: video stays on this device. Only the number is saved.',
};
for (const [k, t] of Object.entries(CAP)) {
  const words = t.split(/\s+/).length;
  if (words > 12) throw new Error(`caption ${k} has ${words} words (max 12)`);
}
if (!/replay/i.test(CAP.c4) || !/synthetic/i.test(CAP.c4) || /\b(live|real)\b/i.test(CAP.c4))
  throw new Error('storm caption must say replay + synthetic and never live/real');

const cameraClip = join(VIDEO, 'shot-camera.mp4');
const hasCamera = existsSync(cameraClip);

// Segments: [clip, offset after the mark (s), duration (s), caption key, extra overlay]
const S1A = { clip: 'shot-1-body', from: 0, dur: 3, cap: 'c1a' };
const S1B = { clip: 'shot-1-body', from: 3, dur: 4, cap: 'c1b' };
const S3 = { clip: 'shot-3-pvt', from: 0, dur: 3, cap: 'c3' };
const S4 = { clip: 'shot-4-storm', from: 1, dur: 6, cap: 'c4' };
const S5 = { clip: 'shot-5-earth', from: 0, dur: 5, cap: 'c5' };
const S6 = { clip: 'shot-6-rotate', from: 0, dur: 4, cap: 'c6', endCard: true };
const CUTS = {
  'ARGUS-video-draft': {
    srt: 'captions.srt',
    segs: [S1A, S1B, { camera: true, dur: 4, cap: 'c2' }, S3, S4, S5, S6],
  },
  'ARGUS-video-nocamera': {
    srt: 'captions-nocamera.srt',
    segs: [S1A, S1B, { clip: 'shot-2-camera-explainer', from: 0, dur: 2, cap: 'nc2' }, { ...S3, dur: 5 }, S4, S5, S6],
  },
};

// ---- caption / slate / end-card PNGs (Playwright, IBM Plex from @fontsource, transparent background) ----
const fontFace = (pkg, fam, w, subset) =>
  `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(
    join(ROOT, 'node_modules', '@fontsource', pkg, 'files', `${pkg}-${subset}-${w}-normal.woff2`),
  ).toString('base64')}) format('woff2');}`;
const FONTS = [400, 500, 600]
  .flatMap((w) => ['latin', 'latin-ext'].map((s) => fontFace('ibm-plex-sans', 'IBM Plex Sans', w, s)))
  .concat([fontFace('ibm-plex-mono', 'IBM Plex Mono', 500, 'latin')])
  .join('');
const mark = readFileSync(join(ROOT, 'public', 'icons', 'icon.svg'), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const BASE_CSS = `${FONTS} *{margin:0;padding:0;box-sizing:border-box} html,body{width:1920px;height:1080px;background:transparent;font-family:'IBM Plex Sans',sans-serif;color:#e6edf3;-webkit-font-smoothing:antialiased}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
async function png(name, body, css = '', opaque = false) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const file = join(WORK, `${name}.png`);
  await page.screenshot({ path: file, omitBackground: !opaque });
  return file;
}
const capCss = `.cap{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);max-width:1640px;padding:20px 40px 22px;
  border-radius:16px;background:rgba(7,9,13,.88);border:1px solid rgba(255,255,255,.14);font-size:48px;font-weight:600;
  line-height:1.2;text-align:center;letter-spacing:-.005em;white-space:nowrap;color:#fff}`;
const capPng = {};
for (const [k, t] of Object.entries(CAP)) capPng[k] = await png(`cap-${k}`, `<div class="cap">${esc(t)}</div>`, capCss);
const slate = await png(
  'slate-camera',
  `<div class="s"><div class="t">CAMERA SHOT — record with a real face</div><div class="u">(see VIDEO_SCRIPT.md shot 2)</div>
   <div class="v">Placeholder in the draft. Put your recording at docs/submission/video/shot-camera.mp4 and run npm run video:assemble.</div></div>`,
  `.s{width:1920px;height:1080px;background:repeating-linear-gradient(45deg,#131a22 0 40px,#0d1117 40px 80px);display:grid;place-content:center;text-align:center;gap:24px}
   .t{font-size:76px;font-weight:600;color:#f5b83d}.u{font-size:44px;color:#e6edf3}.v{font-size:30px;color:#9aa7b4;max-width:1300px;margin:12px auto 0}`,
  true,
);
const endCard = await png(
  'end-card',
  `<div class="e"><div class="m">${mark.replace('<svg', '<svg width="64" height="64"')}<span>ARGUS — Crew Health Autonomy</span></div>
   <div class="l">${esc(team)}</div>
   <div class="l2">NASA Space Apps Challenge 2026 · Create Health Monitoring Software for Astronauts on Space Missions</div>
   <div class="l2">Simulated crew · Prototype, not a medical device</div></div>`,
  `.e{position:absolute;left:64px;top:96px;width:900px;padding:36px 40px;border-radius:20px;background:rgba(7,9,13,.9);border:1px solid rgba(255,255,255,.14);display:grid;gap:16px}
   .m{display:flex;align-items:center;gap:20px;font-size:44px;font-weight:600}.l{font-size:38px;font-weight:500;color:#2dd4bf}
   .l2{font-size:28px;color:#c4ccd5;line-height:1.3}`,
);
await browser.close();

// ---- encoding helpers ----
const run = (args) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const probe = (file, entries) =>
  execFileSync(FFPROBE, ['-v', 'error', '-show_entries', entries, '-of', 'default=nw=1:nk=1', file]).toString().trim();
const ENC = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an'];
const FIT = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#07090D,setsar=1,fps=${FPS}`;

function segment(seg, out) {
  const frames = Math.round(seg.dur * FPS);
  const overlays = [capPng[seg.cap], ...(seg.endCard ? [endCard] : [])];
  let inputs;
  let pre;
  if (seg.camera && hasCamera) {
    // The hand-recorded camera take: everything but the last second sped up to 3 s, then 1 s on the result.
    const d = Number(probe(cameraClip, 'format=duration'));
    if (d > seg.dur + 0.05) {
      const a = d - 1;
      inputs = ['-i', cameraClip];
      pre = `[0:v]trim=0:${a},setpts=(PTS-STARTPTS)*${(seg.dur - 1) / a},${FIT}[a];[0:v]trim=${a}:${d},setpts=PTS-STARTPTS,${FIT}[b];[a][b]concat=n=2:v=1:a=0[base]`;
    } else {
      inputs = ['-i', cameraClip];
      pre = `[0:v]${FIT},tpad=stop_mode=clone:stop_duration=${seg.dur}[base]`;
    }
  } else if (seg.camera) {
    inputs = ['-loop', '1', '-t', String(seg.dur), '-i', slate];
    pre = `[0:v]${FIT}[base]`;
  } else {
    const start = marks[seg.clip]?.start;
    if (start === undefined) throw new Error(`no mark for ${seg.clip}: run record-video.mjs first`);
    inputs = ['-ss', (start + seg.from).toFixed(3), '-t', String(seg.dur + 0.5), '-i', join(RAW, `${seg.clip}.webm`)];
    pre = `[0:v]${FIT}[base]`;
  }
  let chain = pre;
  let last = 'base';
  overlays.forEach((o, i) => {
    inputs.push('-i', o);
    chain += `;[${last}][${i + 1}:v]overlay=0:0[o${i}]`;
    last = `o${i}`;
  });
  run([...inputs, '-filter_complex', chain, '-map', `[${last}]`, '-frames:v', String(frames), ...ENC, out]);
}

const srtTime = (t) => {
  const ms = Math.round(t * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

for (const [name, cut] of Object.entries(CUTS)) {
  const parts = [];
  let t = 0;
  const srt = [];
  cut.segs.forEach((seg, i) => {
    const out = join(WORK, `${name}-${i}.mp4`);
    segment(seg, out);
    parts.push(out);
    srt.push(`${i + 1}\n${srtTime(t)} --> ${srtTime(t + seg.dur)}\n${CAP[seg.cap]}\n`);
    t += seg.dur;
  });
  const list = join(WORK, `${name}.txt`);
  writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const final = join(VIDEO, `${name}.mp4`);
  run(['-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-an', '-movflags', '+faststart', final]);
  writeFileSync(join(VIDEO, cut.srt), srt.join('\n'));
  const dur = Number(probe(final, 'format=duration'));
  const info = probe(final, 'stream=codec_name,width,height,r_frame_rate,pix_fmt').split('\n').join(' ');
  const mb = (statSync(final).size / 1048576).toFixed(2);
  console.log(`${name}.mp4  ${dur.toFixed(3)} s  ${info}  ${mb} MB${name.includes('draft') ? (hasCamera ? '  (camera: shot-camera.mp4)' : '  (camera: SLATE)') : ''}`);
  if (dur > MAX_TOTAL) throw new Error(`${name}: ${dur} s is over ${MAX_TOTAL} s`);
}
