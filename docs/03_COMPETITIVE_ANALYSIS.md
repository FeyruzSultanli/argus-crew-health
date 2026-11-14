# 03 — Competitive analysis

Snapshot taken 14 Nov 2026 from public GitHub repositories tagged for this challenge. Treat others as
moving targets — re-check before submission.

## 1. Primary benchmark: Crew Health Monitor (AdityaK0804/Crew-Health-Monitor)

Live demo: https://crew-health-monitor.vercel.app · Stack: React 19, TypeScript, Vite, Tailwind, Motion,
three.js; Node built-in HTTP server + SQLite; ~4,900 lines of TS/TSX. **No license file → all rights
reserved. We do not copy code or assets from it.** (Their anatomy meshes come from BodyParts3D and HRA,
both CC BY 4.0 — we may obtain those from the original sources and credit them.)

### 1.1 What it does well (our floor — we must match or exceed every row)

| Area | Their implementation | ARGUS must… |
|------|---------------------|-------------|
| Visual quality | Dark, neutral UI; colour only for attention; Geist type; Phosphor icons; subtle motion | Match polish with our own identity (IBM Plex, Lucide, mission-control aesthetic) |
| 3D body | Real organ meshes (BodyParts3D male, HRA female), flagged region glows, camera flies to signal, system filters | Same + mission-day scrubber animating status over time + layer toggle + per-organ "function" card |
| Earth vs space rules | Two rule sets side by side; counts "false alarms" and "missed by Earth" | Three layers + quality; headline "caught only by personal baseline" |
| Sourcing | Every threshold has a source or "Demo parameter" label; research log | Same discipline via `seed/sources.json` with status + on-screen source drawer |
| Signal set | 13 crew + 2 cabin signals (hematocrit, ONSD, IJV flow, CO₂ headache, urine, WBC, vitamin D, exercise, radiation, sleep, SpO₂/HR, mood, mass, BP/temp/glucose) | Cover the challenge's core six vitals with real measurement paths, plus SANS, bone, radiation, cognition, CO₂ |
| Mission settings | ISS / Moon surface / Mars transit; delay, dose rate, gravity | ISS / Lunar transit (Orion) / Lunar surface base / Pressurized rover / Mars transit / Mars surface |
| Today screen | Tasks, crew at a glance, free-text "how do you feel" | Same + streaks, readiness, scheduled exams with cadence, quick-measure buttons |
| Earth link | Delayed messages with countdown; roles | Same + FHIR packet, bandwidth estimate, provenance per value |
| Offline handbook | Rule-based Q&A over own data, no AI | Same principle; optional on-device rewording as stretch |
| Emergency | Step-by-step, timed, saved | Protocols with source tags; large-target "glove mode" |
| Image attach | Stores photo; explicitly does not analyse it | **We analyse camera input** (rPPG, face geometry, Amsler drawings) |
| Roles/privacy | Crew / CMO / flight surgeon; enforced only when running locally with server | Same roles; local-first with sync adapter interface |
| Honesty | "Read this first", limits table | Same, plus a Limits page in-app |

### 1.2 Their self-declared gaps (our opportunity)
From their README "What it would take to be real":
- All readings simulated; no real device integration → **we measure live with the camera and accept device imports.**
- Every threshold is fixed and population-based → **we add the personal baseline layer.**
- Images not analysed → **we analyse camera frames (rPPG, face geometry).**
- No standards mapping → **we trace to NASA-STD-3001 and export FHIR.**
- Radiation is a constant per mission setting → **we use live NOAA GOES + NASA DONKI data and a dose ledger.**
- Moon gravity behaviour is an assumption → we keep assumptions labeled the same way (no false precision).

## 2. Other 2026 submissions seen (pattern summary)

| Project | Stack / approach | Takeaway |
|---------|------------------|----------|
| AURORA (fabriciojunio) | Earth-independent, real NASA/NOAA radiation data, simulated crew | Live space-weather is not unique — our edge must be the dose ledger + shelter logic + integration with personal health |
| ASTRA HEALTH (Janyar2016) | Python/Streamlit, rule-based explainable checks, JSON export | Explainability is table stakes |
| COSMOCare, ASTROCARE | ML anomaly detection, chatbot | ML on invented data is a validity weakness — we use transparent statistics with published precedents |
| VITALS (QuantumBytes) | Decision-support dashboard, scenarios | Generic dashboards are common — differentiation must be visible in the first 5 seconds |
| Astro Sağlık (AstroPulse) | 3D web game | Gamification exists — ours must feel operational, not playful |
| Past: Microdoze (2018), Skylab (2022 Global Nominee), AstroState (2022) | Bio-Monitor data, AI diagnosis, Flutter app | The theme recurs; judges have seen many dashboards |

## 3. Positioning statement for the pitch

> Most entries check readings against fixed thresholds. ARGUS asks a better question: *is this unusual for
> this astronaut, in this environment, and can we trust the measurement?* — and it measures with hardware
> already on board.

## 4. "Beat-the-benchmark" acceptance checklist (used in the final QA pass)

- [ ] First screen communicates the three-layer idea within 5 seconds.
- [ ] A live measurement (camera pulse) works in the deployed demo.
- [ ] Live NOAA proton data (or clearly labeled cached snapshot) is visible.
- [ ] 3D body is at least as smooth (≥ 50 fps on a mid laptop) and loads under 4 s on broadband.
- [ ] Every number on screen has a source badge.
- [ ] FHIR export produces valid JSON.
- [ ] Works offline after first load (airplane-mode test).
- [ ] The 7-slide deck exists and is public.
