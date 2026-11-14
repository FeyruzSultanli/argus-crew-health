# Submission screenshots

Real captures of the production build (`npm run build && npx vite preview --port 5175`), taken by
`scripts/submission/screenshots.mjs` (Playwright, Chromium, hardware WebGL). Viewport **1920×1080, device scale factor 1**
(1024×768 for the tablet files), dark theme, signed in through `/sign-in` as **CMO** with PIN 2026 on a fresh browser
profile (= the clean demo state: Mars transit, MD 143). No post-editing: only lossless PNG re-compression.
The header with the **SIMULATED DATA** badge is in every file that shows crew data. NOAA was **not mocked**: the
space-weather badge in each file (LIVE / CACHED / SNAPSHOT / REPLAY) is what the app showed at that moment.

Re-take all: `node scripts/submission/screenshots.mjs` (or one group: `… screenshots.mjs environment`).

| File | Route and state | Use |
|------|-----------------|-----|
| `01-sign-in.png` | `/sign-in`, role CMO selected, PIN typed | README; demo walkthrough |
| `02-bridge-cmo-md143.png` | `/` as CMO, MD 143: K. Osei Act + "Caught only by personal baseline", counters (Caught only by personal: 2) | Slide 7 (small Bridge); README |
| `03-body-c3-lens-earth.png` | `/body/c3`, heart clicked (camera on the chest, Resting heart rate card open), lens **Earth**: heart Nominal | Slide 3 inset; video reference |
| `04-body-c3-lens-space.png` | same framing, lens **Space**: heart Nominal | Lens sequence |
| `05-body-c3-lens-personal.png` | same framing, lens **Personal**: heart **Act**; card shows P Act · S Nominal · E Nominal and "Caught only by personal baseline" | Slide 3 (main); project page pillar A; README |
| `06-body-c3-lens-combined.png` | same framing, lens **Combined**: heart Act | Slide 1 visual |
| `07-heart-card-expanded.png` | `/body/c3`, lens Personal, Resting heart rate card expanded: "Do this next" first, Why, Layers | Slide 3 alt |
| `07b-heart-card-detail.png` | element capture of that whole card (action, why, three layers, numbers, band chart) | Detail / zoom-in |
| `08-trends-c3-heart-rate-act.png` | `/trends/c3`: resting-HR excursion with the ACT marker at MD 143, personal and pre-flight bands | Project page; README |
| `09-lab-hub.png` | `/lab`, K. Osei selected (Vision check and Face fluid-shift scan tiles live, "Experimental — not validated" on the face tile, only Device import left as "Coming next") | Slide 4 context; project page pillar B |
| `10-camera-pulse-privacy.png` | `/lab/camera` step 1 (explainer) with the privacy line "Video stays on this device. Only the number is saved." | Slide 4; project page pillar B (until a real camera result exists) |
| `11-camera-pulse-how-to.png` | `/lab/camera` step 2 "How to measure" | Slide 4 alt; video no-camera cut |
| `12-reaction-test-result-test-mode.png` | `/lab/pvt?pvtTest=1&pvtProfile=slow` → Start → Result (not saved), "TEST MODE — scripted responses (slow)" badge | Slide 4 |
| `13-environment-before-replay.png` | `/environment?replaySpeed=3600` before the replay: data mode **LIVE** (real NOAA fetch, "fetched just now"), S0 | Slide 5 inset |
| `14-environment-replay-s2.png` | same, Replay SPE running, held at **S2**: "Shelter advised." banner (DEMO POLICY), REPLAY + "synthetic S2-class profile (demo), not a recorded event" on banner, S tile and flux chart; "Modeled — illustrative" at the bottom | Slide 5 (main); project page pillar C |
| `14b-environment-replay-s2-full.png` | same state, full page (whole dose ledger and cabin cards) | Reference |
| `15-environment-replay-dose-ledger.png` | same state scrolled to the dose ledger: "Modeled — illustrative. Real crew dose comes from personal dosimeters.", modeled SPE dose per crew | Slide 5 alt |
| `16-earth-link-composer.png` | `/earth?crew=c3&flags=1`, compression 60×: K. Osei's summary, "modeled delay (demo)", "Demo parameter" | Slide 6 alt |
| `17-earth-link-packet-in-transit.png` | after **Send to flight surgeon**: packet card **In transit**, "arrives in 11 min (demo: 11 s)", countdown | Slide 6; project page pillar D |
| `17b-earth-link-fhir-preview.png` | same packet **Delivered**, FHIR JSON preview opened | Slide 6 |
| `18-surgeon-view-delivered.png` | second tab signed in as **Flight surgeon**, `/earth`: the delivered packet, provenance "modeled delay (demo)" | Slide 6 alt; project page |
| `19-crew-overview.png` | `/crew` (CMO): K. Osei first with Act, readiness "Demo parameter" | Project page |
| `20-handbook-index.png` | `/handbook` | Project page |
| `21-handbook-sleep-entry.png` | `/handbook/sleep`: current verdict, source badges | Project page |
| `22-protocol-suspected-infection-step.png` | `/handbook/suspected-infection`, step 2 of 6 | Project page |
| `23-limits.png` | `/limits`: not-a-medical-device block + start of the real / measured / simulated / modeled table | Slide 6 (split); project page validity |
| `23b-limits-full.png` | same, full page (whole table) | Reference |
| `24-source-drawer-provenance.png` | `/environment`, source drawer opened on the career limit 600 mSv: SRC_STD3001_RAD, Verified source, accessed date (badge shows SNAPSHOT: the live fetch failed at that moment) | Provenance proof |
| `25-demo-parameter-tag.png` | `/`, hover on the "D" badge of the one-way comms delay: tooltip tag **DEMO PARAMETER** | Honesty proof |
| `26-settings-demo-controls.png` | `/settings?demo=1` after "Jump" on Silent infection: "K. Osei selected" | Demo prep |
| `27-tablet-bridge.png` | `/` at 1024×768 | README (tablet) |
| `28-tablet-body.png` | `/body/c3` at 1024×768, lens Personal (heart Act, skin Watch), no region opened | README (tablet) |
| `29-tablet-environment.png` | `/environment` at 1024×768 (LIVE) | README (tablet) |
| `31-vision-check-menu.png` | `/lab/vision?visionTest=1&amslerScript=peripheral`, K. Osei: "Screening only — not a diagnosis.", TEST MODE — scripted input, choose Amsler grid / Near acuity | Project page pillar B |
| `32-vision-screen-calibration.png` | same, Amsler grid → Screen calibration (bank-card outline, slider; fresh profile, "not calibrated yet") | Project page pillar B |
| `33-amsler-grid-two-marks-test-mode.png` | Right eye — Amsler grid after "Apply scripted marks (peripheral)": two squares marked W (wavy), TEST MODE badge. The calibration was saved at its default slider value (headless screen, no card): the grid's physical size here means nothing | Project page pillar B |
| `34-amsler-result-watch-new-area.png` | Amsler result after **Save**: right eye 2 marked / 2 new since the test of MD 120, "Outlined in red: new area since last test", "Saved … labeled SIMULATED (scripted test mode)", Verdict **Watch** | Slide 4; project page pillar B |
| `34b-amsler-result-watch-full.png` | same, full page (whole verdict with the three layers) | Reference |
| `35-near-acuity-optotype.png` | `/lab/vision?visionTest=1&acuitySeed=7` → Near acuity → with glasses → ruler → Right eye: tumbling E, logMAR 1.0 letter 1 of 5, four direction buttons, TEST MODE | Project page pillar B |
| `36-face-scan-explainer.png` | `/lab/face`, K. Osei: "Experimental — not validated" badge, "No pre-flight scan exists in this demo…", privacy line + "No image is saved. Only the numbers are stored." | Project page pillar B |
| `37-face-scan-how-to.png` | same, Continue → "How to scan" (4 steps, reference scan "not set yet"), badge in the header | Reference |

Not captured: a face fluid-shift scan **result** (needs a real face; not faked). Not captured: a camera-pulse **result** with a real bpm. Automation has no face (the fake camera gives "no face → poor
quality"), and a faked reading is not allowed. Capture it by hand on a real person (Lab → Camera pulse → Continue →
Start; do not press Save) and save it as `30-camera-pulse-result.png` for slide 4 and pillar B.
