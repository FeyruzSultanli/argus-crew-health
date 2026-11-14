# Live demo for local judges — 3 minutes, plus Q&A

Written against the build on `main`. Numbers on day 143 come from the shipped seed; all crew data is simulated.

## Pre-demo reset (do this 10 minutes before; takes about 3 minutes)

1. Laptop on power, notifications off, one Chrome window, network on. Backup: the same build running locally
   (`npm run build && npm run preview` → `http://localhost:4173/`).
2. **Tab B (flight surgeon) first.** Open `https://feyruzsultanli.github.io/argus-crew-health/` → role **Flight
   surgeon** → PIN **2026** → **Sign in as Flight surgeon** → open **Earth** (`/earth`). Leave this tab open and do not
   reload it during the demo.
   Why this order: the demo session is stored in the browser and the last sign-in wins after a reload, so the CMO
   tab, signed in last, survives a reload.
3. **Tab A (CMO).** New tab, same URL → role **CMO** → PIN **2026** → **Sign in as CMO** → Mission Bridge.
4. Tab A: user menu → **Settings** (or `/settings?demo=1`) → **Reset demo** → confirm **Reset demo**. Header must show
   **Mars transit · MD 143/210**. If not: Demo controls → **Change profile** → Mars transit; scrubber → **Today**.
5. Tab A: Demo controls → Scenarios → **Silent infection** → **Jump** (selects K. Osei, day 143).
6. Tab A: open **Environment** once so the NOAA feed loads (data-mode bar shows LIVE, or CACHED / SNAPSHOT with its
   age). Set the replay speed to **3600×**. Do not start the replay yet.
7. Tab A: Lab → **Camera pulse** → Continue → Start → allow the camera → **Discard and exit** (permission is now
   granted, no prompt on stage).
8. Tab A: go back to the **Bridge** (`/`). Ready.

## Script (time marks are targets; 1–2 sentences to say per step)

| Time | Where and what to click | What to say | What the screen shows (day 143, Mars transit, CMO) |
|------|------------------------|-------------|------------------------------------------------------|
| 0:00 | Bridge `/` (tab A). Point at the header and the right column. | "This is ARGUS on a simulated Mars transit, day 143. Earth is 11 minutes away — that delay is modeled for the demo." | Mission chip MD 143/210; Earth link tile "11 min · modeled delay (demo)"; SIMULATED DATA badge; hero line "Every signal judged three ways: Personal · Space · Earth"; counter **Caught only by personal baseline 2**. The hero is the CMO's own status (L. Duarte; read the readiness off the screen — she carries a radiation Watch, projected 93 % of the career limit). |
| 0:20 | Crew at a glance → click the **K. Osei** row. | "The CMO sees the crew sorted by urgency. K. Osei is on Act, and the flag was caught only by her personal baseline." | K. Osei first: **Act**, readiness **65**, top flag Resting heart rate · Act, marker "Caught only by personal baseline". |
| 0:30 | Body `/body/c3`: click the heart hotspot. **Layer lens** → **Earth**, then **Space**, then **Personal**. | "On Earth rules her heart is fine. On space rules too. Only against her own baseline does it light up." | Heart neutral on Earth and Space, lit **Act** on Personal (and Combined). Female HRA reference body; 2D toggle if 3D is slow. |
| 0:50 | Right panel: the **Resting heart rate** card (expanded). Scroll it top to bottom; click one source badge. | "Action first: tell the CMO, check temperature and symptoms, open the suspected-infection protocol. Then why, the three layers, her band, and the source of every number." | "Do this next" (demo wording); explanation; layers Personal Act · Space Nominal · Earth Nominal; band chart last 30 days with her personal band 54–62 bpm and 69 bpm today; body temperature 37.0 °C vs her usual 36.6 °C is on Watch (personal only); source drawer with the verified/partial/demo status. |
| 1:15 | Header **Measure now** → **Camera pulse** → Continue → **Start 30-second measurement** on the presenter. | While it runs: "This is my real pulse from the laptop webcam: face tracking runs on the device, nothing is uploaded. The quality score checks signal, motion, light and face presence." | Live view with countdown and waveform; result bpm + quality pill (Good / Fair / Poor with reasons). Press **Discard and exit** (saving would change K. Osei's simulated record). |
| 1:45 | **Environment**. Point at the data-mode bar, then **Replay SPE** (3600×). | "The radiation panel reads NOAA's GOES proton flux. Now a synthetic S2-class storm replay: the shelter advisory comes up and every crew dose is tracked against the NASA limits." | Data mode LIVE (or CACHED / SNAPSHOT) before the click; then REPLAY + "synthetic S2-class profile (demo), not a recorded event"; S1 at about 2 s, **S2 and "Shelter advised."** from about 3 s to 7 s; dose ledger with "Modeled — illustrative" and the 600 mSv career limit. Press **Stop replay** before leaving. |
| 2:15 | Nav **Crew** → K. Osei card → **Send packet** (opens `/earth?crew=c3&flags=1`) → **Send to flight surgeon**. Open the FHIR JSON preview. Switch to **tab B** after about 11 s. | "The crew acts now; the flight surgeon gets a compact FHIR-style packet when the delay has passed — 11 minutes, compressed to 11 seconds for the demo." | Packet card: Queued → In transit → Delivered, "arrives in 11 min (demo: 11 s)" with a "Demo parameter" tag. Tab B shows the received packet only after delivery. |
| 2:35 | Tab A: user menu → **Limits** (`/limits`). | "Everything is labeled: what is real, measured, simulated, modeled or a demo parameter. The camera pulse has not been validated against a reference device yet — that is our next step." | Real / measured / simulated / modeled / demo / experimental table; "Not a medical device" statement; camera validation block: "No paired validation against a reference device has been done yet." |
| 2:50 | Stay on Limits or go back to the Bridge. | "ARGUS — Personal. Space. Earth. Decisions on board, when Earth is minutes away." | — |

## Fallback lines

| If… | Do | Say |
|-----|----|-----|
| Camera permission denied, no camera, or quality Poor | Show the error card or the Poor result, then **Enter pulse manually instead** | "When the signal is not good enough ARGUS says so and offers a retake or manual entry instead of a number it cannot stand behind." |
| Network down | Environment shows CACHED or SNAPSHOT with the data age | "Offline, the panel falls back to the last cached NOAA data or the bundled snapshot and says how old it is. Everything else works offline." |
| Live site does not load | Switch to the local preview (`http://localhost:4173/`), sign in again | "Same build, running locally." |
| 3D is slow or blank | Stage toolbar → **2D** | "There is a 2D fallback with the same regions." |
| Replay does not start | Show slide 5 or the Limits row "Solar particle event replay" | "The replay is a synthetic profile; here is how it is labeled." |
| Tab B does not show the packet | Stay in tab A: the packet card turns **Delivered** after 11 s. Do not reload tab B | "Delivered after the modeled delay." |
| Signed out by accident | Sign in again as CMO, PIN 2026 | — |

## After the demo

Tab A: **Settings → Reset demo** (removes the sent packets and any saved readings) so the next judge starts clean.

## Judge Q&A (short answers, true to this build)

| Likely question | Answer |
|-----------------|--------|
| Why not machine learning? | There is no public in-flight vital-sign data to train on, and our crew data is simulated, so a model would learn our own simulator. We use transparent statistics — median and MAD baselines, z-score, CuSum, a state machine — that a flight surgeon can audit line by line; the same personal-baseline idea is published for wearables. The engine matched an independent reference implementation on 600 random series. ML can come once real data exists. <!-- SRC_ALAVI_2022, SRC_MISHRA_2020 --> |
| Is webcam pulse accurate enough? | We have not yet compared it with a reference device, and we do not claim an accuracy figure. It uses a published method (POS), shows a quality score with reasons, refuses to save a poor reading as good, and is meant for screening and trends next to medical devices, not instead of them. Paired validation is our first next step. |
| How do you avoid false alarms? | Robust baselines (median/MAD with spread floors), CuSum plus hysteresis so one reading never raises Act, quality gating, and the space layer turns known adaptations into "Expected in space" — for example short in-flight sleep. On day 143 the Bridge shows how many Earth flags the space layer explains. |
| Is the radiation dose real? | The proton flux is real NOAA GOES data (live, cached or the bundled snapshot). The storm you saw is a synthetic S2-class replay, because no real event happened in the seven days before the build. Cosmic-ray dose rates are published measurements applied to the mission profile; the solar-event dose is modeled and labeled illustrative; pre-mission doses are simulated. NASA's DONKI event list is not connected — the service did not answer on build day. Real crew dose would come from personal dosimeters. |
| Where is the vision test? | Lab → Vision check. It is a screening test, not a diagnosis, modeled on the ISS laptop tests: the screen is calibrated with a bank card, then an Amsler grid per eye compared with the previous test, and near acuity with a tumbling E at 60 cm. The calibration is set by the user with a card; we have not yet verified it with a ruler. |
| What is the face scan? | An experimental, not validated face fluid-shift scan: 3 seconds of face geometry against your own first scan on this device. Trend only — it never raises Watch or Act, no image is saved, and it has not yet been tried on real faces. |
| How would NASA use this? | As a crew-facing front end on a CHP-IDSP-like data platform: one local data service with adapters, FHIR-style export with LOINC and UCUM codes, NASA-STD-3001 traceability, offline-first, delay-aware. |
| What about privacy? | Local-first: data stays in the browser's database. Camera frames are processed in memory and never stored or sent; only the number is saved. Crew, CMO and flight-surgeon roles see different views; the surgeon sees only delivered packets. Encryption at rest and real identity are future work (demo PIN only). |
| Is any of this real data? | Real: NOAA proton flux, NASA OSDR pre-flight blood values of Inspiration4 crew used as anchors (OSD-569, OSD-575), the published limits, and anything you measure yourself. Simulated: the four crew members and their daily readings, the cabin sensors and the storm replay. Every screen with simulated data carries the badge. |
