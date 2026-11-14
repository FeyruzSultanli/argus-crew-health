# Demo video (draft)

| File | What it is |
|------|-----------|
| `ARGUS-video-draft.mp4` | `VIDEO_SCRIPT.md` shot by shot, 29.0 s. Shot 2 (camera) is a **slate** "CAMERA SHOT — record with a real face": not submittable until the real take is dropped in. |
| `ARGUS-video-nocamera.mp4` | Complete, submittable 29.0 s cut that does **not** show a pulse measurement (see "Differences"). |
| `captions.srt`, `captions-nocamera.srt` | English subtitles, same text and timings as the burned-in captions. |

Both: H.264, 1920×1080, 30 fps, yuv420p, no audio track. Footage = real Playwright screen recordings (1920×1080) of the
production build (`npm run build && npx vite preview --port 5175`, fresh browser profile, CMO, PIN 2026, Mars transit
MD 143); NOAA was not mocked. Captions and end card are PNGs rendered in IBM Plex Sans and burned in by ffmpeg; simple
cuts, no speed-up except the camera take (shot 2, captioned "sped up"). The pointer is a large drawn cursor that
follows the real mouse events (Playwright does not record the system cursor).

## Timeline as built

| Time | Draft | No-camera cut | Caption |
|------|-------|---------------|---------|
| 0–3 s | 1a `/body/c3`, heart card open, lens Earth (neutral) → Space (neutral) | same | Mars transit, day 143. Earth is 11 minutes away (modeled). |
| 3–7 s | 1b click Personal → heart Act; pointer to "Caught only by personal baseline" and the layer row | same | Normal for Earth and space rules. Caught only by her baseline. |
| 7–11 s / 7–9 s | 2 **slate** (or `shot-camera.mp4`) | 2′ `/lab/camera` step 1, pointer on the privacy line (2 s) | Re-checked with the laptop camera: real pulse, quality scored, sped up. / Laptop-camera pulse: video stays on this device. Only the number is saved. |
| 11–14 s / 9–14 s | 3 `/lab/pvt?pvtTest=1&pvtProfile=slow` → Start → result, TEST MODE badge (3 s) | same, 5 s | Reaction Self-Test, 3 minutes (scripted test run shown). |
| 14–20 s | 4 `/environment?replaySpeed=3600`, click + 1 s … + 7 s: REPLAY, S1 → S2, "Shelter advised.", synthetic wording | same | Solar storm replay (synthetic): shelter advised, every crew dose tracked. |
| 20–25 s | 5 `/earth?crew=c3&flags=1`, 60×, Send → "arrives in 11 min (demo: 11 s)", In transit, countdown | same | Crew acts now. The flight surgeon gets the packet 11 minutes later. |
| 25–29 s | 6 `/body/c3`, lens Combined, slow drag-rotate + end card (ARGUS — Crew Health Autonomy · Dark Star · NASA Space Apps Challenge 2026 · challenge title · Simulated crew · Prototype, not a medical device) | same | ARGUS. Personal. Space. Earth. Decisions on board. |

## Differences from VIDEO_SCRIPT.md, and why

- **No-camera cut, 7–14 s:** the script's shot 2 (4 s) must show a real pulse on a real face; automation has no face
  and a faked reading is not allowed. It is replaced by the camera explainer with the privacy line (2 s, own caption,
  12 words) and a longer shot 3 (5 s instead of 3 s). Nothing in this cut claims a pulse was measured.
- **Draft, 7–11 s:** a slate instead of footage until `shot-camera.mp4` exists.
- Shot 1a: the heart card is opened by clicking the heart hotspot before the usable part starts (as the script says).
- Shot 6: the end card is overlaid top-left; the header with SIMULATED DATA stays visible.

## Honesty checks (asserted by `record-video.mjs` while recording; seen in extracted frames)

SIMULATED DATA badge visible in every crew-data shot (1, 3, 4, 5, 6 and the camera explainer) · storm shot: REPLAY in
the header and on the screen, "synthetic S2-class profile (demo), not a recorded event", shelter banner, "Modeled —
illustrative"; the storm caption says replay + synthetic and never "live"/"real" (checked by `assemble-video.mjs`) ·
Earth link: "modeled delay (demo)" and "Demo parameter" · reaction test: "TEST MODE — scripted responses (slow)",
not saved · no validation numbers · no NASA logos · team name on the end card from `../slides/deck.config.json`.

## Make the final cut (with the real camera shot)

1. Serve the app: `npm run build && npx vite preview --port 5175 --strictPort` (or use the live site).
2. Record the camera take by hand (phone or screen recorder, any aspect): Lab → Camera pulse → Continue → Start 30-second
   measurement, real face, good light; keep recording until the result (bpm + quality pill) has been on screen ≥ 1 s;
   **do not press Save**. Trim so the clip starts at Start and ends on the result.
3. Save it as `docs/submission/video/shot-camera.mp4`.
4. Run `npm run video:assemble`. Everything except the last second is sped up to 3 s, then 1 s on the result.
   The draft becomes the final cut (29.0 s); the script prints the duration and fails above 29.5 s.
5. Re-record any automated shot: `npm run video:record -- storm` (shots: body, camera-explainer, pvt, storm, earth,
   rotate; `ARGUS_URL=https://feyruzsultanli.github.io/argus-crew-health` to record from the live site), then step 4.
   Raw clips live in `raw/` (git-ignored). Needs ffmpeg/ffprobe on PATH.
6. Team name on the end card: `../slides/deck.config.json` → `teamName`, then step 4.

## Türkçe — adım adım

1. Uygulamayı açın: `npm run build && npx vite preview --port 5175 --strictPort` (ya da canlı site).
2. Kamera çekimini elle kaydedin (telefon ya da ekran kaydı): Lab → Camera pulse → Continue → Start 30-second
   measurement, gerçek yüz, iyi ışık; sonuç (bpm + kalite etiketi) en az 1 sn ekranda kalana kadar kayda devam edin.
   **Save'e basmayın.** Klibi Start'tan başlayıp sonuçta bitecek şekilde kırpın.
3. Dosyayı `docs/submission/video/shot-camera.mp4` olarak kaydedin.
4. `npm run video:assemble` çalıştırın: son saniye hariç her şey 3 sn'ye hızlandırılır, sonra 1 sn sonuç gösterilir.
   Taslak (`ARGUS-video-draft.mp4`) son kurgu olur (29,0 sn); 29,5 sn'yi aşarsa betik hata verir.
5. Kamera çekimi yoksa doğrudan `ARGUS-video-nocamera.mp4` gönderilebilir (nabız ölçümü göstermez).
6. Otomatik bir çekimi yeniden kaydetmek için: `npm run video:record -- storm` (body, camera-explainer, pvt, storm,
   earth, rotate), sonra 4. adım. Takım adı: `../slides/deck.config.json` → `teamName`, sonra 4. adım.
