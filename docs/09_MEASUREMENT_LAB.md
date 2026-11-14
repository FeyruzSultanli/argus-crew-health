# 09 — Measurement Lab

The Lab is where ARGUS stops being a dashboard: the crew measures with hardware already on board
(a laptop/tablet camera and screen) and every result flows into the same three-layer evaluation.
Every flow starts with a **How to measure** card (≤ 5 steps, icon per step), modeled on the guided
procedure support NASA tested with Tempus Pro (iAssist) [SRC_TEMPUS_USABILITY].

Lab hub tiles: **Camera pulse** (P0) · **Reaction Self-Test** (P0) · **Manual vitals** (P0) ·
**Vision check** (P1) · **Device import** (P1) · **Face fluid-shift scan** (P2, experimental).

**Subject and day quality (all Lab flows).** A measurement is saved for `ui.selectedCrewId` (default: the signed-in
crew member; the CMO picks the crew member first). Every flow shows a chip "Measuring: <name>", and the result
screen says "Compared with <name>'s simulated baseline" — the camera and the Reaction Self-Test measure the person
at the laptop, while the demo crew and their baselines are simulated. Saved observations use the current
`mission.missionDay`. When a day has several readings the engine uses their median (doc 08 §1) and the day's
quality is that of its best reading (doc 07 §3 step 9). Manual entries and simulated observations have quality
`{ score: 1, label: 'good', reasons: [] }`.

---

## 1. Camera pulse (rPPG) — FR-LAB-2

### 1.1 Method
Plane-Orthogonal-to-Skin (POS) remote photoplethysmography [SRC_POS_WANG2017 · verified]. POS is a widely used,
training-free algorithm that performs well across lighting conditions among classical rPPG methods
[SRC_RPPG_KOSSACK · verified]. Face regions come from MediaPipe Face Landmarker (478 landmarks, runs in the
browser via WASM) [SRC_MEDIAPIPE_FACE · verified].

### 1.2 Pipeline
```
getUserMedia({ video: { width: 640, height: 480, frameRate: 30, facingMode: 'user' } })
 └─ per frame (requestVideoFrameCallback when available, else rAF):
     FaceLandmarker.detectForVideo(video, ts)  (runningMode VIDEO, numFaces 1)
     ROIs = forehead + left cheek + right cheek polygons from landmarks
     draw frame to OffscreenCanvas (downscaled 320×240), compute mean R,G,B over ROI pixels
     also record: ROI luminance, % clipped pixels (≥ 250), landmark centroid (for motion)
     postMessage({ t: ts_ms, r, g, b, lum, clip, cx, cy }) → rppg.worker
rppg.worker:
  1. Resample RGB traces to uniform 30 Hz (linear interpolation on timestamps).
  2. POS (sliding window l = 1.6 s = 48 samples, step 1 sample):
       Cn = C_window / mean(C_window)           (per channel temporal normalisation)
       S1 = Gn − Bn ;  S2 = Gn + Bn − 2·Rn
       h  = S1 + (std(S1)/std(S2)) · S2
       h  = h − mean(h)  → overlap-add into output pulse signal P
  3. Band-pass P to 0.7–3.0 Hz (42–180 bpm): 4th-order Butterworth (biquad cascade) or FFT mask.
  4. Spectrum: Welch PSD (segment 10 s, 50 % overlap, Hann), zero-padded to 0.1 bpm resolution.
  5. HR = argmax PSD in band × 60.
  6. Quality (see 1.3). Emit live estimate each second after 10 s; final at 30 s.
```
ROI definition (geometric, from a few stable landmarks, so no long index lists are needed). Landmark numbers below
are the usual MediaPipe face-mesh indices — **confirm them on the
`?debug=rppg` overlay with a real face**: 10 = top of forehead,
152 = chin, 234 / 454 = left / right face edge, 168 = between the eyes, 33 / 263 = outer eye corners,
61 / 291 = mouth corners. With W = |p454 − p234| and F = |p168 − p10|:
- forehead box: centre p10 + 0.45·(p168 − p10), half-width 0.28·W, half-height 0.22·F;
- cheek boxes: centres at the midpoints of (p33, p61) and of (p263, p291), half-size 0.09·W each way.
Boxes are axis-aligned in the image and clipped to it. Exclude eyes, brows, lips and nostrils (the boxes above avoid
them when the face is upright; reject frames with head roll > 15°).

### 1.3 Quality score (all thresholds demo parameters)
| Check | Metric | good | fair | poor |
|-------|--------|------|------|------|
| Spectral SNR | dB: power within ±6 bpm of HR peak and its 2nd harmonic vs rest of 0.7–4 Hz band, computed on the POS signal *before* the 0.7–3.0 Hz band-pass (after it the 2nd harmonic is gone for any HR above 90 bpm) | ≥ 3 | 0–3 | < 0 |
| Consistency | |HR(first 15 s) − HR(last 15 s)| | ≤ 5 bpm | ≤ 10 | > 10 |
| Motion | SD of landmark centroid (px at 640 w) | ≤ 3 | ≤ 8 | > 8 |
| Lighting | mean ROI luminance; clipped % | 60–200; < 2 % | 40–220; < 5 % | otherwise |
| Face presence | % frames with face | ≥ 95 % | ≥ 80 % | < 80 % |
`quality.label` = worst label across checks; `score` = mean of normalised checks; `reasons` lists failing checks
in plain words ("too much movement", "too dark").

### 1.4 UX
1. How-to card: sit still, face the screen, even light on face, no backlight, 30 s, breathe normally.
2. Live view: face outline with ROI tint, distance hint, lighting meter, countdown ring, live pulse waveform and a
   *stabilising* HR number (greyed until 10 s).
3. Result: big bpm, quality pill, "Compare with your usual" mini-band, Save / Retake. Poor → Save disabled
   (can still "Save as poor quality" for the record).
4. Privacy note under the video: "Video stays on this device. Only the number is saved."

### 1.5 Validation (do this during the hackathon — it is a strong Validity point)
Team members take 5+ paired measurements: ARGUS camera vs a fingertip pulse oximeter (or smartwatch) at the same
time. Record in `docs/VALIDATION.md`: n, mean absolute error, Bland–Altman bias ± limits. Show the table on the
Limits page. If MAE > 5 bpm under good quality, say so honestly.

### 1.6 Stretch: respiration rate
Vertical motion of nose-tip/chin landmarks, band 0.1–0.5 Hz (6–30 breaths/min), same spectrum approach. Label experimental.

---

## 2. Face fluid-shift scan (experimental, P2) — FR-LAB-5

Weightlessness shifts fluid toward the head (the "puffy face" adaptation) [SRC_NASA_RISKS context]. We track
facial geometry relative to the astronaut's own pre-flight scans; no validated threshold exists, so this index
is **trend-only** and never drives WATCH/ACT.

- Capture 3 s of frames; accept frames with |yaw|, |pitch| < 10° (from facial transformation matrix) and neutral
  expression (blendshape jawOpen < 0.1, smile < 0.2).
- Normalise distances by inter-pupillary distance (iris centre landmarks, refine-landmarks model).
- Features: cheek width / IPD; jaw width / IPD; mean eye aperture (upper-lower lid) / IPD.
- `face_fluid_index = mean(feature_today / feature_preflight_mean)` across width features. Eye aperture shown separately.
- Store only numbers; snapshot image stored only with opt-in checkbox.
- Badge: "Experimental — not validated".

---

## 3. Vision check (P1) — FR-LAB-4

Modeled on the ISS in-flight vision exam, which includes acuity software on a laptop and an Amsler grid on a
laptop [SRC_VISION_ISS · verified]; SANS affects a majority of long-duration crew [SRC_SANS_CAMBRIDGE · verified].
**Screening only** — the UI says so.

### 3.1 Screen calibration (once per device)
- Physical size: user drags a slider until an on-screen card matches a real ID-1 card (85.60 × 53.98 mm, any
  bank/ID card) → `pxPerMm`. Store per device.
- Viewing distance: estimate live from the camera with a pinhole model:
  `f_px = (videoWidth / 2) / tan(HFOV / 2)` with an assumed webcam horizontal field of view of 65° (demo parameter,
  user-adjustable), and `distance_mm = f_px · IPD_mm / IPD_px`, using an assumed adult inter-pupillary distance of
  ~63 mm [SRC_IPD_DODGSON · partial]. Expect ±15 % error; show "move closer / farther" until within ±10 % of the
  target. If the camera is denied → instruct a measured distance (ruler) and mark quality 'fair'.

### 3.2 Amsler grid
- Grid 20 × 20 squares, each 5 mm (computed with pxPerMm), central fixation dot, high contrast (black on white
  — this screen ignores dark theme). Viewing distance 30–35 cm (each square ≈ 1° of visual field).
- One eye at a time (instruction: cover the other eye; wear usual near glasses).
- User taps/drags to paint cells that look wavy, blurred or missing; three brushes: wavy / blurred / missing.
- Saved as `visionMaps` record: 400-cell bitmask per kind + eye + missionDay; observation value = count.
- Diff vs previous map for the same eye → new cells highlighted; central = within 2 cells of fixation.

### 3.3 Near acuity (tumbling E)
- Target distance 60 cm — an intermediate-distance screen test, not a 40-cm near card; say so in the UI. At 60 cm
  a logMAR 0.0 optotype is 0.87 mm tall (about 3–4 CSS px at 96 dpi), so draw in device pixels and expect the
  resolution-limit stop near logMAR 0.1–0.2 on screens that are not HiDPI.
- Optotype height `h_mm = d_mm · tan( (5 · 10^logMAR) / 60 · π/180 )`; 5 optotypes per line; lines logMAR 1.0 → 0.0
  in 0.1 steps; user answers direction with arrow keys/large buttons.
- Line passed if ≥ 3/5 correct; score = last passed line − 0.02 × extra correct letters on the next line
  (ETDRS-style letter scoring). Stop if `h_px < 5` → report "screen resolution limit reached at logMAR X".

---

## 4. Reaction Self-Test (PVT-B style) — FR-LAB-3

Modeled on NASA's 3-minute PVT-B, used on the ISS as the "Reaction Self-Test" and part of the Cognition battery
[SRC_COGNITION · verified], [SRC_PVT_SPINOFF · verified]. Parameters below follow the published PVT-B design as
we understand it [SRC_PVT_B_BASNER2011 · verified]: inter-stimulus interval 1–4 s, lapse
threshold 355 ms. False start < 100 ms is the usual PVT convention (not re-checked at source).

- Duration 180 s. Stimulus: a counting millisecond timer appears in a red-bordered box; respond with Space,
  any key, or a large tap target (≥ 120 px).
- ISI uniform random 1.0–4.0 s (seeded per session, store seed).
- Timing: `performance.now()`; measure from the frame the stimulus is painted (use rAF timestamp after DOM update).
  Disable during tab hidden; abort session if tab loses focus > 2 s.
- Classify: RT < 100 ms or response with no stimulus → false start; RT ≥ 355 ms → lapse; timeout 30 s → lapse.
- Metrics: median RT, mean response speed (mean of 1000/RT, s⁻¹), lapses, false starts,
  performance score = 1 − (lapses + false starts) / number of stimuli. Speed and median RT use valid responses only
  (false starts excluded; a 30-s timeout counts as a lapse with RT = 30 000 ms).
- Saved observation: `value` = mean response speed (unit `/s`), `components` = `{ medianRtMs, lapses, falseStarts,
  nStimuli }` — see doc 06 §3 and doc 07 §4.9.
- A user's first-ever run is labeled "practice". (The simulated crew already have weekly pre-flight runs — doc 12 §4.)
- Device latency differs between machines; personal baselines compare like with like — show a note
  "Use the same device for comparable results".
- Result screen: speed vs personal band, lapses vs baseline, sleep last night, verdict, suggestion.

---

## 5. Manual vitals — FR-LAB-1

Single form with steppers and large targets; units toggle; validation per doc 06 §3; optional context fields
(posture, fasting state, time since exercise). Each field has an inline **How to measure** expander
(general clinical practice wording, tagged "demo wording"):

| Signal | How to measure (summary) |
|--------|--------------------------|
| Blood pressure | Rest 5 min seated (restrained in microgravity), arm supported at heart level, correct cuff size, no talking; take 2 readings 1 min apart, enter the average |
| Pulse oximetry | Warm finger, no nail polish, keep still 30 s, read when number is stable |
| Temperature | Same device and site each time; note if after exercise |
| Glucose | Wash/dry hands, lancet on side of fingertip, first drop on strip; note fasting or not |
| Body mass | Use the mass-measurement device per its procedure; same time of day |
| Sleep | From wearable (auto) or self-report hours + quality 1–5 |
| Mood | 5 faces scale + optional note ("one line about today") |
| Symptoms | Checklist (doc 07 §4.17) |

---

## 6. Device import — FR-LAB-6

- Accept `.csv` / `.json`. Column mapper: user maps columns → `signalId`, unit, timestamp; preview first 10 rows;
  validation errors listed per row; import as `source.kind = 'import'`, `label = 'MEASURED'`.
- Ship sample files in `seed/import-samples/` that are **clearly synthetic** (file header comment
  "synthetic sample, format illustrative"): `smart-garment-sample.csv` (timestamp, hr, br, spo2, skin_temp, steps),
  `actigraph-sample.csv` (date, sleep_start, sleep_end, sleep_minutes, light_lux_mean), `dosimeter-sample.csv`
  (timestamp, dose_uSv_cumulative).
- Mention in UI: "Formats like CSA's Bio-Monitor smart shirt or the ARCHeR actigraph would plug in here via an adapter."
