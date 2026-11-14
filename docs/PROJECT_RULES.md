# Project rules — ARGUS

This repository holds **ARGUS — Crew Health Autonomy**, a submission to the NASA Space Apps Challenge 2026,
challenge *"Create Health Monitoring Software for Astronauts on Space Missions"*.
Hard deadline: **Sunday 15 November 2026, 23:59 local time** (submission closes; the demo must be public by then).

Read `docs/00_INDEX.md` first: it lists the documents and what each one covers.

---

## 1. The product in one paragraph

ARGUS is an offline-first web application (PWA) that lets astronauts on long missions measure,
understand and act on their own health without waiting for Earth. Every health signal is judged by
**three layers** — the astronaut's **personal baseline**, **space-adapted rules** from published NASA
sources, and **Earth clinical reference ranges** — plus a **data-quality layer**. It measures with what
a crew already has (webcam vital signs via rPPG, on-screen vision tests modeled on the ISS laptop tests,
the 3-minute Reaction Self-Test modeled on NASA's PVT-B), ingests **live NOAA/NASA space-weather data**
for radiation, and maps everything to NASA-STD-3001 requirements and a FHIR-style data model so it can plug
into NASA's future Crew Health and Performance data platform (CHP-IDSP).

## 2. Non-negotiable rules

1. **No invented numbers.** Every threshold, rate, limit or physiological fact shown in the UI must reference
   an entry in `seed/sources.json`. Each entry has `status`: `verified`, `partial` or `demo`.
   - `demo` values are allowed but the UI must label them **"Demo parameter"**.
   - If you need a new number, add a source entry. If you cannot find a real source, mark it `demo`.
   - Never fabricate a URL, DOI, author or quote. Leave `url: null` and set `status: "partial"` if unsure.
   - Demo parameters already have shared registry entries — `SRC_DEMO_RULE_BANDS`, `SRC_DEMO_BASELINE_ENGINE`,
     `SRC_DEMO_RADIATION_MODEL`, `SRC_DEMO_QUALITY_SCORES`, `SRC_DEMO_READINESS`, `SRC_DEMO_SIMULATION`. Use these;
     do not create new demo IDs. If you must add a real source, append it at the end of `seed/sources.json` in its
     own small commit.
2. **Simulated data is always labeled.** A persistent `SIMULATED DATA` badge is shown whenever any
   simulated crew data is on screen. Live data (NOAA/DONKI, the user's own camera/manual measurements) is
   labeled `LIVE` or `MEASURED`.
3. **Not a medical device.** Never write wording that diagnoses or prescribes drug doses. Actions are
   phrased as "re-measure", "tell the Crew Medical Officer", "send to flight surgeon", "follow protocol X".
   Emergency/protocol steps are tagged `source` or `demo wording`.
   Action and protocol texts come only from `docs/07_CLINICAL_RULES.md` (the signal-specific templates in §4, the
   generic templates in §3, the protocol steps in §5). Do not write new clinical advice, treatment steps or crisis
   messaging, and do not build keyword detection on free-text notes.
4. **Offline-first.** Core features must work with the network off: rules, baseline engine, measurements,
   3D body, handbook. Network is only for live space weather (with cached fallback) and optional extras.
5. **No NASA logos, flags, insignia or mission patches** anywhere (Space Apps branding rule). Our own mark only.
6. **Do not copy code from `AdityaK0804/Crew-Health-Monitor`** or any repo without an OSI license. We use it
   only as a UX reference. Third-party assets must be CC0, CC BY (credited) or OSI-licensed (credited in `CREDITS.md`).
7. **Privacy.** Camera frames are processed in memory and never stored or uploaded. Only derived numbers are
   saved. Face-scan snapshots are saved only after explicit opt-in.

## 3. Tech stack (fixed — do not swap without updating docs/05_ARCHITECTURE.md)

- Vite 7 + React 19 + TypeScript (strict) + Tailwind CSS v4
- React Router 7 (data routers not needed; simple `createBrowserRouter`)
- Zustand (UI/session state) + Dexie 4 with `dexie-react-hooks` (persistent offline data in IndexedDB)
- three.js via `@react-three/fiber` + `@react-three/drei` (3D body)
- Recharts 3 (charts) — custom-styled, never default colors
- Motion (`motion/react`) for animation; respect `prefers-reduced-motion`
- `@mediapipe/tasks-vision` (Face Landmarker) — WASM + model **self-hosted under `public/mediapipe/`**
- `vite-plugin-pwa` (Workbox) for offline caching
- Vitest + @testing-library/react (unit), Playwright (smoke e2e)
- Icons: `lucide-react`. Fonts: IBM Plex Sans + IBM Plex Mono via `@fontsource` (OFL)

## 4. Code conventions

- `src/domain/**` is **pure TypeScript** (no React, no DOM, no Dexie). All medical logic lives here and is
  unit-tested. UI imports it; nothing in `domain` imports UI.
- One signal definition per file in `src/domain/signals/` registered in `src/domain/signals/index.ts`.
- Units: store in SI/UCUM as defined in `docs/06_DATA_MODEL.md`; convert only at display.
- Time: store ISO-8601 UTC strings plus `missionDay` (integer, launch day = 1; pre-flight = negative, L-30 → -30).
- No `any`. No default exports except React route components. Named exports everywhere else.
- Every user-visible number must render through `<Value>` (shows unit, source badge and freshness).
- Keep components under ~250 lines; split otherwise.
- Accessibility: all interactive targets ≥ 44×44 px (gloved / microgravity use), visible focus, ARIA labels,
  WCAG AA contrast in both themes.

## 5. Definition of done (every change)

- `npm run typecheck`, `npm run lint`, `npm test` all pass.
- New domain logic has unit tests including the test vectors given in the docs.
- No console errors in the browser on the affected screens.
- Screens checked at 1440×900 and 1024×768 (tablet) widths.
- Decisions and deviations from the spec are recorded in `docs/DECISIONS.md`; new third-party assets in `CREDITS.md`.
- Acceptance criteria that need a camera, a ruler, a GPU or a visual check are checked by hand. Until then they are
  listed as open (README "Known limits"); never report them as passed.
- Commit with a clear message. Do not push secrets. `.env` is git-ignored.

## 6. When the docs are silent or contradictory

Prefer, in order: (1) safety/honesty rules above, (2) `docs/04_REQUIREMENTS.md`, (3) the specific module
doc, (4) the smallest change that keeps the demo working. Record the decision in
`docs/DECISIONS.md`.

## 7. Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run build && npm run preview
npm test             # vitest
npm run test:e2e     # playwright smoke
npm run typecheck
npm run lint
npm run fetch:data   # scripts/fetch-data.ts — downloads OSDR + NOAA snapshots into seed/ (needs network)
```
