# 01 — Product vision

## 1. The problem (from the challenge, sharpened)

Long-duration missions expose astronauts to the five hazards NASA's Human Research Program has mapped —
space radiation, isolation and confinement, distance from Earth, altered gravity, and a hostile closed
environment. The challenge asks for "a visual tool that helps astronauts assess their own health during
space missions and provides guidance on treatments and health improvements".

Three facts turn this from a dashboard exercise into a real engineering problem:

1. **The doctor is minutes away — or more.** On a Mars transit a one-way message takes 4–22 minutes,
   so a question and its answer can take ~45 minutes. NASA's own direction is "Earth-independent medical
   operations": the crew must decide on board.
2. **Earth normal ranges are wrong in space, and population ranges are wrong for an individual.**
   Space changes "normal" (fluid shift, bone loss, hematocrit, sleep). Fixed thresholds either raise false
   alarms or miss a meaningful change that is still "within range". A resting heart rate of 72 bpm is normal
   on any lab sheet — but for an astronaut whose baseline is 58 bpm it is a 7-sigma shift and a classic
   early sign of infection or overreaching.
3. **Astronauts are not continuously monitored today.** On the ISS, vital signs are recorded mostly during
   exercise and spacewalks, through a collection of discrete devices; measurements happen periodically.
   The crew needs low-burden ways to measure — ideally with hardware they already carry.

## 2. Our answer — ARGUS in one sentence

**ARGUS turns every health reading into a decision the crew can act on, by judging it against the
astronaut's own baseline, against space-adapted NASA evidence and against Earth references — and it
measures with hardware the crew already has.**

## 3. Users and their jobs

| User | Situation | Job to be done |
|------|-----------|----------------|
| Crew member | Busy, not medically trained, may be fatigued | "Tell me in 5 seconds whether I'm OK, what to measure today, and what to do if not." |
| Crew Medical Officer (CMO) | Responsible for the whole crew, limited training | "Show me who needs attention, why, and walk me through the next step." |
| Flight surgeon (Earth) | Sees data late, through a delayed link | "Give me a compact, trustworthy packet: what changed, against which baseline, with what data quality." |
| Mission / programme reviewer (judge, NASA) | Evaluating feasibility | "Is this scientifically valid, standards-aligned and deployable?" |

## 4. The four pillars (our differentiators)

### Pillar A — Three-layer verdict + data quality ("Personal · Space · Earth")
Every signal gets three independent judgements and one combined verdict:

| Layer | Question it answers | Source of truth |
|-------|---------------------|-----------------|
| **Personal** | Is this unusual *for this astronaut*? | Personal baseline engine (pre-flight + adaptive in-flight), robust z-score and CuSum — doc 08 |
| **Space** | Is this expected or concerning *in this mission environment*? | Space-adapted rules from NASA standards/evidence — doc 07 |
| **Earth** | Would a clinic on Earth flag it? | Standard clinical reference ranges — doc 07 |
| Quality | Can we trust the reading? | Source, age, signal quality (e.g., rPPG SNR) — doc 06 |

The combined verdict uses five states: `NOMINAL`, `EXPECTED` (a known spaceflight adaptation — informative,
not alarming), `WATCH`, `ACT`, `NO DATA`. The UI always shows *which layer drove the verdict*, in plain words.
The headline metric on screen: **"caught only by personal baseline"** — concerns that fixed thresholds miss.

### Pillar B — Measure with what's on board (Measurement Lab)
- **Camera vitals** — pulse rate from a webcam using the published POS rPPG algorithm (doc 09), with a
  signal-quality score and an honest "retake" path.
- **Face fluid-shift index (experimental)** — facial-geometry trend vs the astronaut's pre-flight scans.
- **Vision check** — calibrated on-screen Amsler grid and near-acuity test, modeled on the ISS laptop vision
  tests used for SANS surveillance.
- **Reaction Self-Test** — a 3-minute psychomotor vigilance test modeled on NASA's PVT-B "Reaction Self-Test".
- **Guided manual entry** — blood pressure, glucose (mg/dL), temperature, SpO₂, mass, sleep, mood — each with
  a step-by-step "how to measure" card (like Tempus Pro's iAssist guidance for untrained users).
- **Device import** — CSV/JSON from wearables (Bio-Monitor/Astroskin-style smart garment, actigraph).

### Pillar C — Live radiation & environment awareness
- Real-time GOES proton flux from NOAA SWPC and SEP events from NASA DONKI, converted to the NOAA S-scale.
- Mission dose ledger against NASA-STD-3001 limits (career 600 mSv; 250 mSv per SPE design limit).
- Shelter advisory logic (labeled as a demo policy; real calls are made by NASA's radiation team).
- Cabin CO₂ against the NASA-STD-3001 1-hour limit (≤ 3 mmHg) and the headache-risk evidence.
- Works offline from a cached snapshot with "data age" shown.

### Pillar D — Standards alignment ("ready to plug into NASA")
- Every requirement traces to NASA-STD-3001 Vol 1/Vol 2 items or HRP risks (doc 04).
- Data model mirrors FHIR Observation with LOINC/UCUM codes; one-click export as a FHIR Bundle (doc 06).
- Architecture follows the CHP-IDSP idea: a local "crew health data service" with adapters, so the same UI
  can run on a vehicle computer, a tablet, or a ground console.
- Flight-surgeon packet: compact, delay-aware report with provenance of every value.

## 5. The demo story (drives the live demo)

> **Mars transit, mission day 143. Comms delay: 11 minutes.**
> 1. A solar particle event replay (a recorded NOAA GOES event if one was captured, otherwise the labeled synthetic
>    S2 profile of doc 10 §8 — always badged REPLAY, never called live) lights up the radiation panel: S2 storm,
>    "Shelter advised". The crew dose ledger updates.
> 2. On the Crew screen, flight engineer **K. Osei**'s heart rate is green on Earth rules and on space rules —
>    but ARGUS's personal layer flags **ACT**: her resting heart rate has climbed for three days and is now
>    +11 bpm (body temperature +0.6 °C) above *her own* baseline. "Caught only by personal baseline."
> 3. The CMO taps "Measure now" → camera vitals in 30 s confirm 74 bpm (quality: good) → Reaction
>    Self-Test shows more lapses than her baseline.
> 4. ARGUS proposes: rest, hydrate, re-measure in 6 h, notify flight surgeon. One tap packages a FHIR
>    report; the Earth link shows "arrives in 11 min".
> 5. Closing frame: "Personal. Space. Earth. Decisions on board, when Earth is 11 minutes away."

## 6. How we win the judging criteria

Space Apps judges on **Impact, Creativity, Validity, Relevance, Presentation**.

| Criterion | What judges look for | Our proof point |
|-----------|---------------------|-----------------|
| Impact | Solves a big problem; inspires many | Earth-independent care is a top NASA gap for Mars; same engine applies to remote/rural care on Earth |
| Creativity | Novel approach | Three-layer verdict with "caught only by personal baseline"; webcam vitals; live space weather → dose ledger |
| Validity | Scientifically sound, works in reality | Every number sourced and status-labeled; published algorithms (POS rPPG, PVT-B, CuSum baselines); honest limits page |
| Relevance | Responsive to the challenge, complete, usable | Covers every challenge item: indicators, assessment, guidance, body figure, charts, colour coding, gamification, prompts, multiple environments, instructions |
| Presentation | Clear demo | 7-slide deck, live PWA link, polished UI |

Challenge-text coverage checklist (must all be visibly demonstrable):
- [ ] gathers health indicators (BP, HR, blood sugar mg/dL, temperature, sleep hours, mood) — Lab + check-in
- [ ] input by keyboard, mouse **and camera images** — manual entry, Amsler drawing, rPPG/face scan
- [ ] astronauts evaluate and act — verdict + action-first cards + protocols
- [ ] clickable human figure with function and status per part — 3D body
- [ ] animations and interactivity — mission-day scrubber animates the body; motion throughout
- [ ] different environments (spacecraft, station, rover, base) — mission profiles incl. lunar/Mars surface habitat & pressurized rover
- [ ] prompts to measure as part of mission routine — Today plan + scheduled exams
- [ ] gamification — routine streaks, crew "readiness" and badges
- [ ] dynamic charts over time — Trends with personal bands
- [ ] colour coding at a glance — status palette
- [ ] simple instructions on measurements, indicators and risks — "How to measure" + "Why it matters in space"

## 7. Non-goals (say so on screen, on the Limits page)

- Not a diagnostic or certified medical device; no drug dosing.
- No claim that rPPG or the face index replace clinical instruments.
- Simulated crew data is synthetic; real NASA datasets are used for pre-flight anchors and environment.
- No real identity/security system (demo PINs); design notes describe what flight software would need.

## 8. Product name and voice

- Name: **ARGUS** (the hundred-eyed watchman). Tagline: *Crew health autonomy*. (Team may rename; change in
  `src/config/brand.ts` only.)
- Voice: plain, calm, specific. Lead with the action. No jargon without a one-line explanation.
  Good: "Resting pulse is 11 beats above your usual. Re-measure after 20 min rest." Bad: "Tachycardic anomaly detected."
