# 04 — Requirements

Priority: **P0** = required for the submitted demo · **P1** = strongly wanted · **P2** = stretch.
Trace column refers to NASA-STD-3001 items (V1/V2), HRP risks, challenge text (CH) or source IDs.

## 1. Functional requirements

### FR-MIS — Mission context
| ID | Requirement | Pri | Trace |
|----|-------------|-----|-------|
| FR-MIS-1 | User selects a mission profile: ISS (LEO), Lunar transit (Orion-class), Lunar surface base, Pressurized rover (lunar), Mars transit, Mars surface base. | P0 | CH "different environments" |
| FR-MIS-2 | Each profile defines: one-way comms delay (fixed or by mission day), gravity (g), baseline GCR dose rate, resupply availability, default exam cadence. Values come from `seed/missions.json` with sources. | P0 | doc 10 |
| FR-MIS-3 | A mission-day control (scrubber) lets the user move through the simulated mission; all screens update. | P0 | CH "animations" |
| FR-MIS-4 | Mission header always shows profile, mission day, comms delay, data mode (SIMULATED / LIVE). | P0 | |

### FR-SIG — Signals and evaluation
| ID | Requirement | Pri | Trace |
|----|-------------|-----|-------|
| FR-SIG-1 | Signal catalog per doc 07 (core: HR, BP, SpO₂, temperature, glucose, sleep, mood, body mass, reaction test, vision/Amsler, cabin CO₂, radiation dose; extended: hematocrit, WBC, exercise minutes, hydration). | P0 core / P1 extended | CH indicators |
| FR-SIG-2 | Every observation is evaluated by Personal, Space and Earth layers and a Quality check; a combined verdict is produced with a plain-language explanation and the driving layer. | P0 | Pillar A |
| FR-SIG-3 | Verdict states: NOMINAL, EXPECTED, WATCH, ACT, NO DATA; colour + icon + text (never colour alone). | P0 | CH colour coding |
| FR-SIG-4 | Each signal detail shows, in order: **What to do next**, why (driving layer), the three layer verdicts, the trend vs personal band, "About this measurement" (what, why in space, how to measure), linked NASA risk and source list, data provenance and age. | P0 | CH instructions |
| FR-SIG-5 | Staleness: if a signal's newest reading is older than its cadence × 1.5, show "re-measure" task; if older than cadence × 3 → NO DATA. | P0 | |
| FR-SIG-6 | Counters: number of flags by layer and "caught only by personal baseline" across visible crew. | P0 | Pillar A |
| FR-SIG-7 | Each signal is tagged with one of NASA's five hazards and linked NASA HRP risk(s). | P0 | SRC_NASA_HAZARDS, SRC_NASA_RISKS |

### FR-BAS — Personal baseline engine (doc 08)
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-BAS-1 | Pre-flight baseline from L-180…L-1 data: robust median and MAD-based sigma with per-signal floor. | P0 |
| FR-BAS-2 | Adaptive in-flight baseline from the last 14 days of non-flagged readings once ≥ 7 exist. | P0 |
| FR-BAS-3 | Robust z-score + one-sided CuSum per concerning direction; WATCH/ACT state machine. | P0 |
| FR-BAS-4 | Expected spaceflight shift can be applied to the reference (e.g., hematocrit, body temperature). | P1 |
| FR-BAS-5 | Explanation strings: "x units above your usual (z = …), for n days". | P0 |
| FR-BAS-6 | Baseline band (median ± 2σ) drawn on every trend chart. | P0 |
| FR-BAS-7 | Persistent-shift guard: after ≥ 14 days of personal WATCH without ACT, the CMO can "Accept as new normal" (logged); never automatic. | P1 |

### FR-LAB — Measurement Lab (doc 09)
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-LAB-1 | Guided manual entry for BP (systolic/diastolic mmHg), HR, SpO₂ %, temperature °C/°F, glucose mg/dL (mmol/L toggle), body mass kg, sleep hours (+quality 1–5), mood (1–5 + optional note), symptoms checklist. Validation ranges per doc 06. | P0 |
| FR-LAB-2 | Camera vitals: webcam rPPG pulse rate using POS algorithm, 30-s capture, quality score, retake path, result saved as MEASURED observation. | P0 |
| FR-LAB-3 | Reaction Self-Test (PVT-B style, 3 min) with personal-baseline scoring. | P0 |
| FR-LAB-4 | Vision check: screen calibration, Amsler grid per eye with drawing of distorted/missing areas, near-acuity screen. | P1 |
| FR-LAB-5 | Face fluid-shift index (experimental) from face landmarks vs pre-flight reference. | P2 |
| FR-LAB-6 | Import CSV/JSON (smart garment / actigraph / dosimeter) mapped by a column picker. | P1 |
| FR-LAB-7 | Every Lab flow begins with a "How to measure" card (≤ 5 steps, image/icon per step). | P0 |

### FR-RAD — Radiation & environment (doc 10)
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-RAD-1 | Fetch NOAA SWPC GOES integral proton flux (≥10 MeV, ≥100 MeV); compute NOAA S-scale; show chart and level. | P0 |
| FR-RAD-2 | Fetch NASA DONKI SEP events for last 30 days; list with links. | P1 |
| FR-RAD-3 | Offline fallback: last successful fetch cached in IndexedDB; bundled snapshot for first run; "data age" shown. | P0 |
| FR-RAD-4 | Replay mode: a recorded SPE time-series can be replayed at speed for the demo (labeled REPLAY). | P0 |
| FR-RAD-5 | Dose ledger per crew: pre-mission career dose + mission GCR baseline + modeled SPE increments; % of 600 mSv career limit; SPE vs 250 mSv. | P0 |
| FR-RAD-6 | Shelter advisory state (demo policy) with clear text, triggered by S-scale and profile. | P0 |
| FR-RAD-7 | Cabin environment: CO₂ (1-h avg, 7-day avg), temperature, humidity vs NASA-STD-3001 limits. | P0 |

### FR-BODY — 3D body
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-BODY-1 | 3D human body (male/female reference) with organ hotspots mapped to signals; glow colour by verdict. | P0 |
| FR-BODY-2 | Click hotspot/organ → signal detail; camera eases to region. | P0 |
| FR-BODY-3 | System filters: All, Heart & blood, Brain/eyes/nerves, Bones & muscles, Organs & metabolism. | P1 |
| FR-BODY-4 | Organ card: function in one sentence, how spaceflight affects it, linked signals. | P0 |
| FR-BODY-5 | Mission-day scrubber animates verdict changes on the body. | P1 |
| FR-BODY-6 | Fallback 2D body silhouette (SVG) if WebGL unavailable. | P1 |

### FR-CREW — Crew & roles
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-CREW-1 | 4 simulated crew members, fictional names, with pre-flight baselines (blood anchors from OSDR OSD-569/575). | P0 |
| FR-CREW-2 | Roles: Crew member (own data), CMO (all crew), Flight surgeon (only data received via Earth link). Demo sign-in with role picker. | P0 |
| FR-CREW-3 | Crew overview grid sorted by severity with readiness index. | P0 |

### FR-PLAN — Routine, prompts, gamification
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-PLAN-1 | "Today" plan generated from cadence and staleness (e.g., daily check-in, weekly reaction test, vision on FD 10/30/60/90/120 modeled on research cadence). | P0 |
| FR-PLAN-2 | Streaks for routine adherence; badges (e.g., "7-day check-in streak", "Vision baseline set"). | P1 |
| FR-PLAN-3 | Readiness index 0–100 (transparent formula, demo-labeled). | P1 |
| FR-PLAN-4 | Countermeasure guidance cards (sleep hygiene, hydration ≥ 2.5 L/day, exercise adherence, CO₂ awareness) with sources. | P0 |

### FR-EARTH — Earth link
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-EARTH-1 | Compose a report packet (selected crew, time range, flags) → FHIR Bundle JSON + human summary. | P0 |
| FR-EARTH-2 | Delivery simulated with the profile's delay (demo time compression shown); status Queued → In transit → Delivered. | P0 |
| FR-EARTH-3 | Messages from Earth arrive with delay; cross-tab via BroadcastChannel so a second tab can act as flight surgeon. | P1 |

### FR-HELP — Handbook and protocols
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-HELP-1 | Offline handbook: searchable entries for every signal, measurement and hazard (from catalog + sources). | P0 |
| FR-HELP-2 | Rule-based Q&A: answers only from current data + handbook; otherwise "I don't have that". | P1 |
| FR-HELP-3 | Protocol walkthroughs (e.g., "Suspected infection", "SPE shelter", "High CO₂ headache", "Vision change") with large controls and source tags. | P1 |

### FR-DATA — Data & export
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-DATA-1 | All data persisted in IndexedDB (Dexie); survives reload; "Reset demo" button. | P0 |
| FR-DATA-2 | Export FHIR R4 Bundle (Observations with LOINC/UCUM where available) and CSV. | P0 |
| FR-DATA-3 | Import previously exported bundle. | P2 |

### FR-SET — Settings & demo controls
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-SET-1 | Units (°C/°F, mg/dL/mmol/L), theme (dark/light/high-contrast), "glove mode" (larger targets), reduced motion. | P1 |
| FR-SET-2 | Demo controls: scenario selector, time compression, inject event, reset. Hidden behind `?demo=1` or a settings toggle. | P0 |
| FR-SET-3 | Limits & honesty page: what is real vs simulated, not a medical device, known gaps. | P0 |

## 2. Non-functional requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 Offline | Core app usable with network off after first load | PWA precache; airplane-mode test passes |
| NFR-2 Performance | First meaningful paint | < 2.5 s on broadband; 3D body lazy-loaded |
| NFR-3 Performance | 3D scene | ≥ 50 fps on integrated-GPU laptop; body asset ≤ 8 MB (Draco/Meshopt) |
| NFR-4 Accessibility | WCAG 2.2 AA; targets ≥ 44 px; colour never sole carrier | axe-core: 0 serious violations |
| NFR-5 Privacy | No camera frames leave memory; no analytics/trackers | code review + network panel check |
| NFR-6 Reliability | Domain logic coverage | ≥ 85% lines in `src/domain` |
| NFR-7 Traceability | Every displayed number has a source ID | automated check in test (`sources.spec.ts`) |
| NFR-8 Browser support | Latest Chrome/Edge/Firefox desktop; Safari 17+ best-effort; tablet landscape | |
| NFR-9 Deployability | Static hosting (Vercel/GitHub Pages); no server required for demo | |
| NFR-10 Honesty | Simulated badge visible whenever simulated data on screen | e2e check |
