# 12 — Datasets, assets and sources

Space Apps requires NASA data or resources for Global Award eligibility [SRC_SPACEAPPS_GUIDE]. This table is
also the "NASA Data" and "Space Agency Partner & Other Data" sections of the project page (`docs/submission/PROJECT_PAGE.md`).

## 1. Data we use

| Dataset / API | Owner | How ARGUS uses it | Access | License / terms | P |
|---------------|-------|-------------------|--------|-----------------|---|
| HRP Hazards, Risks, Ongoing Research pages | NASA | Hazard tags, risk links, study references on every signal | web links | US Gov public | P0 |
| NASA-STD-3001 technical briefs (CO₂, radiation, ECLSS) | NASA OCHMO | Limits for CO₂, dose, cabin, water, calories | PDFs | US Gov public | P0 |
| OSDR **OSD-569** Inspiration4 CBC | NASA OSDR | Real pre-flight blood anchors + lab reference ranges for 4 fictional crew | `https://osdr.nasa.gov/bio/repo/data/studies/OSD-569`; file list via OSDR API `https://osdr.nasa.gov/osdr/data/osd/files/569` | Open (NASA OSDR) | P0 |
| OSDR **OSD-575** Inspiration4 metabolic/cytokine | NASA OSDR | Pre-flight glucose & metabolic anchors (if glucose present) | same pattern with 575 | Open | P1 |
| GOES integral protons JSON | NOAA SWPC | Live S-scale, flux chart, replay | `services.swpc.noaa.gov/json/goes/primary/` | US Gov public | P0 |
| DONKI SEP events | NASA CCMC | Event list; replay event selection | `kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP` | US Gov public | P1 |
| OSDR RadLab | NASA OSDR | (stretch) verify ISS dose rate / show ISS dosimetry | `visualization.osdr.nasa.gov/radlab/` | Open | P2 |
| CSA Bio-Monitor, radiation article | CSA | Device-import design, neutron context | web | CSA terms (link only) | P0 |
| HRA 3D Reference Organs (Visible Human male/female) | HuBMAP / NIH 3D | 3D body and organs | humanatlas.io / 3d.nih.gov (3DPX-021022, 3DPX-021627) | **CC BY 4.0 — credit required** | P0 |
| MediaPipe Face Landmarker model + WASM | Google | rPPG ROIs, face index, distance estimate | npm `@mediapipe/tasks-vision`; model `face_landmarker.task` | Apache 2.0 | P0 |
| IBM Plex fonts, Lucide icons | IBM / Lucide | UI | npm `@fontsource/ibm-plex-*`, `lucide-react` | OFL 1.1 / ISC | P0 |

## 2. `scripts/fetch-data.ts` (run once on a networked machine; commit outputs)

1. **OSDR**: GET `https://osdr.nasa.gov/osdr/data/osd/files/569` → `studies["OSD-569"].study_files[]` lists two CBC
   CSVs (`LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv`, `LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv`;
   each `remote_url` is relative to `https://osdr.nasa.gov`). Use the one that carries the reference-range columns;
   OSD-575 has `LSDS-8_Comprehensive_Metabolic_Panel_CMP...` in the same two forms;
   download to `seed/osdr/OSD-569_CBC.csv`. Same for 575 (CMP). Log file names and checksums to
   `seed/osdr/MANIFEST.md`. If the API shape differs, download manually from the study page and note it.
2. **Parse**: build `seed/osdr/preflight-anchors.json`:
   `{ subject: "C001", timepoint: "L-92"|"L-44"|"L-3", hematocrit, wbc, lymphocytes, hemoglobin, ranges:{…}, glucose? }`.
   Detect sex-specific range per subject from the hematocrit range columns (doc 06 §6).
3. **NOAA**: save `integral-protons-7-day.json` → `seed/radiation/goes-snapshot.json` with `{capturedAt, data}`,
   keeping only the `>=10 MeV` and `>=100 MeV` channels (all eight energies would be about 1.7 MB).
   If any ≥10 MeV ≥ 10 pfu window exists, also save it as `seed/radiation/spe-replay.json`; otherwise write the
   synthetic profile of doc 10 §8 to that path with `"synthetic": true`.
4. **DONKI**: SEP events for the last 365 days → `seed/radiation/donki-sep-365.json`.
5. Print a summary table; fail loudly on HTTP errors (no silent fallbacks in scripts).
6. **How the app reads seed data.** `seed/sources.json`, `crew.json`, `missions.json`, `scenarios.json` and
   `protocols.json` are imported statically (`resolveJsonModule`). Files fetched at run time (`seed/radiation/**`,
   `seed/handbook/**`, `seed/import-samples/**`) are copied to `public/seed/` by `npm run sync:seed` (hooked into
   `predev` and `prebuild`; `public/seed/` is git-ignored) and fetched from `/seed/...`.

## 3. `scripts/build-anatomy.ts`

1. Download male and female HRA "united" GLBs (or individual organ GLBs listed in doc 07 §6) into `assets-src/`
   (git-ignored).
2. Use `@gltf-transform/core` + `functions`: `dedup`, `weld`, `simplify` (meshoptimizer, target ratio to reach
   ≤ 150k triangles per body), `meshopt` or `draco` compression; prune unused nodes; normalise to metres, feet at
   y = 0, facing +z.
3. Keep/rename nodes to stable ids: `skin, brain, eye_l, eye_r, heart, lung_l, lung_r, aorta, liver, pancreas,
   kidney_l, kidney_r, bladder, spine, pelvis, femur_l, femur_r`. Missing organs → log and fall back to a
   hotspot without mesh.
4. Write `public/anatomy/male.glb`, `public/anatomy/female.glb`, `public/anatomy/manifest.json`
   (`{ build, triangles, nodes[], attribution }`).
5. Append credits to `CREDITS.md`.
**Time-box: 3 hours.** If it slips, ship the SVG body fallback with organ hotspots and keep 3D as P1.

## 4. Simulated data generator (`src/services/sim/`)

Deterministic (seed `"argus-2026"`), per crew, per mission day from −180 to the profile's `demoMissionDay` (no
day 0; nothing after the demo day — doc 05 §6). One reading per signal per cadence day (doc 07 cadences), each with
quality `{ score: 1, label: 'good', reasons: [] }`. All generator constants are demo parameters [SRC_DEMO_SIMULATION · demo].
- Vitals: `x = baseline + weeklyWobble(day) + N(0, σ_noise)` with `σ_noise = 0.7 × sigmaFloor` (doc 08 §7) and
  `weeklyWobble(day) = 0.25 × sigmaFloor × sin(2π·day/7)`. No in-flight shift for vitals. Round to display
  precision (doc 07 §4 band rule). A scenario value given as `absolute` replaces the generated value exactly (no
  noise, no wobble); a `delta` is added to the generated value.
- Sleep (nightly hours): pre-flight `crew.sleep_duration + N(0, 0.35)`; in-flight `crew.sleep_duration − 0.9 +
  N(0, 0.35)` — the same −0.9 h the personal layer expects (doc 08 §7), giving in-flight means of 6.0–6.4 h,
  consistent with SRC_SLEEP_BARGER. No extra "bad nights" outside the scenarios.
- Reaction test: weekly from day −175; speed `crew.pvt_speed + N(0, 0.07)` s⁻¹; lapses 1–3 and false starts 0–1
  (seeded); `lapsesDelta` is added on the scenario's `onDays`, which are extra test days.
- Once the simulator runs, open day 143. If any signal outside the scenario shows a stray personal flag there, change
  the seed string (for example `"argus-2026-b"`) until the day is clean, and record the seed used.
- Blood (hematocrit, WBC): pre-flight from OSD-569 anchors (interpolate between L-92, L-44, L-3 for days
  −180…−1 with small noise; label anchors MEASURED (OSDR), interpolations SIMULATED); in-flight every 30 days.
- Amsler/acuity: baseline 0 cells; one crew develops 2 new peripheral cells at FD 90 (SANS drift scenario).
- Cabin: CO₂ around 2.0–2.6 mmHg with the CO₂-spike scenario; temperature 21–23 °C; RH 40–55 %.
- Scenarios (`seed/scenarios.json`), each with id, label, crew, days, effects, narrative:

| id | crew | days | effect | demonstrates |
|----|------|------|--------|--------------|
| `silent-infection` | c3 K. Osei | 141–143 | RHR absolute 63/68/69 (= +5/+10/+11, no noise); body temp +0.3/+0.5/+0.6 °C; mood 0/−1/−1 | caught only by personal baseline |
| `co2-spike` | cabin + all | 118–122 | ppCO₂ 3.4–4.2 mmHg; headache symptoms | missed by Earth rules |
| `sleep-debt` | c2 M. Ito | 130–136 | sleep 5.2–5.6 h; reaction lapses +4 | Earth false alarm vs real concern |
| `sans-drift` | c1 R. Vance | 90 | Amsler +2 cells right eye; near acuity +0.1 logMAR | vision surveillance |
| `spe-event` | all | 143 | replay SPE; shelter advisory; modeled SPE dose | radiation pillar |
| `normal-adaptation` | all | all in-flight days | hematocrit within expected rise; sleep = pre-flight − 0.9 h (means 6.0–6.4 h) | EXPECTED state |

## 5. Source discipline

- Every number shown in UI → `sourceIds` → `seed/sources.json`. `scripts/check-sources.ts` (run in CI/test)
  greps `SRC_[A-Z0-9_]+` in `src/` and fails on unknown IDs; also fails if any signal rule lacks `sourceIds`.
- Before submission, try to verify all `partial` entries (open the source; correct the
  number or downgrade to `demo`). Record outcomes in `docs/DECISIONS.md`.
