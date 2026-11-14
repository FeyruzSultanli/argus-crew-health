# 11 — UI/UX specification

Benchmark: Crew Health Monitor's interface (doc 03). Our bar: **at least as calm and polished, more
informative per glance, and visibly "operational"** — it should look like software a flight controller would
trust, not a game. Desktop/tablet landscape first (1440×900 and 1024×768); phone is best-effort.

## 1. Design principles

1. **Action first.** Every card leads with what to do, then why.
2. **Colour means status — nothing else.** Neutral chrome; colour appears only for verdicts and live alerts.
   Never rely on colour alone: every status has icon + word.
3. **Show the layers.** The user can always see *which* layer (Personal / Space / Earth) drove a verdict.
4. **Provenance on every number.** Unit, source badge, freshness.
5. **Calm motion.** Motion explains change (state transitions, camera moves, scrubbing); 150–250 ms ease-out;
   none when `prefers-reduced-motion`.
6. **Glove-ready.** 44 px minimum targets; "Glove mode" raises to 56 px and font +2 px.

## 2. Design tokens (`src/ui/tokens.css`, Tailwind v4 `@theme`)

### Colour — dark theme (default)
| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | #07090D | app background |
| `--surface-1` | #0D1117 | cards |
| `--surface-2` | #131A22 | raised / hover |
| `--border` | #1E2630 | hairlines |
| `--text` | #E6EDF3 | primary text |
| `--text-2` | #9AA7B4 | secondary |
| `--text-3` | #6B7785 | tertiary / captions |
| `--brand` | #2DD4BF | brand accent (focus ring, selected nav) — not a status |
| `--ok` | #3DD68C | NOMINAL |
| `--info` | #5AB8FF | EXPECTED / informational |
| `--watch` | #F5B83D | WATCH |
| `--act` | #FF5A5F | ACT |
| `--muted` | #5B6672 | NO DATA |
Each status also has `-bg` (12 % alpha) and `-border` (35 % alpha) variants.
Light theme: invert neutrals (bg #F7F9FB, surface #FFFFFF, text #0B1220); status hues darkened for AA contrast
(ok #13804F, info #1C6FB8, watch #A86A00, act #C42B30). High-contrast theme: pure black/white + status hues, 2 px borders.

### Typography
IBM Plex Sans (UI) and IBM Plex Mono (telemetry, numbers, timestamps). Scale: 12 / 14 / 16 / 20 / 24 / 32 / 48 px;
line-height 1.4 (text) / 1.1 (numbers). Numbers use `font-variant-numeric: tabular-nums`.

### Spacing, radius, elevation
4-px grid; card padding 20 px; gaps 12/16/24; radius 12 px cards, 8 px controls, 999 px pills;
elevation by surface colour, not heavy shadows (one subtle shadow for overlays).

## 3. App shell

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◈ ARGUS │ Bridge  Body  Trends  Lab  Environment  Crew  Earth  Handbook │ [MARS TRANSIT ▾]  │
│         │                                                              │ MD 143/210 · ⟳ 11 min│
│         │                                     [SIMULATED DATA] [LIVE SPACE WX] [● offline]   │
│         │                                       [Measure now] [Protocols ⚠]  L. Duarte · CMO │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│                                      page content                                          │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ Mission scrubber: ◀ ▶  ▁▂▁▁▃▁▁▅▇▃▁ (flag density per day)  ● day 143        [▶ replay]       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```
- Header 64 px. Mission chip opens profile picker (with environment icons) and shows one-way delay live.
- Badges: `SIMULATED DATA` (outline, always when simulated crew visible), `LIVE`/`CACHED`/`SNAPSHOT`/`REPLAY` for
  space weather, offline dot.
- **Mission scrubber dock** (Body, Trends, Bridge): a 40 px timeline across mission days with a tiny bar per day
  showing count of WATCH/ACT (colour-stacked). Drag to time-travel; the whole app re-evaluates for that day.
  Keyboard: ←/→ day, Shift+←/→ week. This is our signature interaction.

## 4. Core components (`src/ui/`)

| Component | Notes |
|-----------|-------|
| `StatusPill` | verdict → colour, icon, word; sizes sm/md |
| `LayerTriad` | three mini-pills "P · S · E" with verdicts; hover/tap explains each |
| `Value` | number + unit + source badge (✓ verified, ~ partial, D demo) + freshness ("3 h") + provenance tooltip |
| `SourceDrawer` | right sheet listing sources used on the current card with status and link |
| `SignalCard` | collapsed: label, latest value, LayerTriad, sparkline with personal band; expanded: full detail (§5.2) |
| `ActionCard` | tinted by verdict; "Do this next" + primary button (Measure / Open protocol / Send to Earth) |
| `BandChart` | Recharts line + personal band area + pre-flight dashed band + event markers |
| `Gauge` | ring gauge for CO₂, dose %, readiness |
| `Countdown` | for Earth-link delivery and rPPG capture |
| `HowTo` | step list with icons; collapsible |
| `EmptyState`, `Skeleton`, `ErrorState` | consistent states |
| `Toast` | bottom-right, 4 s, status-coloured left border |
| `KeyHint` | shows keyboard shortcuts in tooltips |

## 5. Screens

### 5.1 Mission Bridge (Today) — `/`
Purpose: "Am I OK, what do I do today, what's happening around me?"
Layout (12-col):
- **Left 8 cols**
  - Hero strip: greeting + personal status ring (worst verdict + readiness 0–100) + one-line summary
    ("All signals in your usual range except sleep — expected in flight.").
  - **Today's plan** (FR-PLAN-1): task rows with checkbox, type tag (Measure/Check-in/Exam/Countermeasure), why,
    points; inline "Start" buttons deep-link into Lab flows. Streak chip ("🔥 12-day check-in streak" — use an icon,
    not emoji) and badges row.
  - **Crew at a glance** (CMO only): rows with StatusPill, counts by layer, "caught only by personal" marker.
- **Right 4 cols**
  - Space weather tile (S-level, flux sparkline, mode badge, shelter banner if any).
  - Cabin tile (CO₂ gauge 1-h & 7-day, temp/humidity).
  - Earth link tile (next message ETA, last received).
  - Quick check-in: mood faces + sleep hours + symptoms chips + "Save" (2 taps).

### 5.2 Body — 3D crew health — `/body/:crewId`
Three-column layout (like the benchmark, improved):
- **Left rail (280 px)**: crew list (with StatusPill & mini LayerTriad counts) + Cabin row; **Layer lens** segmented
  control `Combined | Personal | Space | Earth`; counters: "Earth flags 8 · Space flags 6 · Personal flags 5 ·
  **Caught only by personal 2** · Earth false alarms 3"; recent activity.
- **Centre**: 3D body (doc §6). Name + role; live wearable chip (HR/SpO₂, simulated); zoom buttons; region
  quick-jumps (Head, Chest, Abdomen, Legs); system filter chips; attribution caption.
- **Right panel (420 px)**: "N need attention" list → SignalCards sorted by severity, then "Normal today".
  Expanded SignalCard order (FR-SIG-4):
  1. ActionCard ("Do this next" + button)
  2. Why: driving layer sentence(s)
  3. LayerTriad expanded: three small panels Personal / Space / Earth each with verdict + reason + numbers
  4. BandChart (last 30 days, personal band, space-expected band)
  5. About this measurement: what, why in space, how to measure (HowTo), hazard tag, NASA risk link, related NASA study
  6. Provenance: source kind, device/method, quality pill with reasons, time & age; SourceDrawer link
- Selecting a signal flies the camera to its region and pulses the hotspot.

### 5.3 Trends — `/trends/:crewId`
- Small multiples grid (2–3 columns) of selected signals; each BandChart shares the mission-day x-axis; brushing
  syncs all charts; event markers (SPE, CO₂ spike, sleep debt, illness) as vertical labeled lines.
- "Compare crew" toggle overlays crew medians (CMO only).
- Export PNG/CSV for current view.

### 5.4 Measurement Lab — `/lab`
- Hub: 6 tiles (doc 09) with last measured, due status, duration estimate ("30 s", "3 min").
- Each flow: full-screen focused mode (header collapses to a thin bar with "Exit"), HowTo first, then live
  capture, then result with LayerTriad and "Save".
- Camera flows show a permission explainer before requesting the camera.
- Every flow shows the subject chip "Measuring: <name>" and saves for `ui.selectedCrewId` (doc 09, "Subject and
  day quality").

### 5.5 Environment — `/environment`
- Top: Shelter advisory banner (if any) with countdown since onset.
- Row 1: S-level tile · ≥10 MeV & ≥100 MeV flux chart (log y, thresholds S1–S5 dashed, 6 h / 1 d / 3 d / 7 d tabs) ·
  DONKI event list.
- Row 2: Dose ledger per crew (stacked horizontal bars with 600 mSv marker and projected end-of-mission ghost bar);
  SPE-this-event meter vs 250 mSv.
- Row 3: Cabin — CO₂ gauge + 7-day chart with 3 mmHg (STD-3001) and 2.5 mmHg (headache-risk) lines; temp/humidity
  comfort-zone scatter.
- Data mode badge + "fetched 4 min ago" + source links.

### 5.6 Crew — `/crew` (CMO, surgeon)
- Table/cards per crew: readiness gauge, worst verdict, flags by layer, overdue tasks, last measurement time,
  "Send packet" action. Sorted by severity. Click → Body.

### 5.7 Earth link — `/earth`
- Left: compose packet (choose crew, period, include flags only / all; preview human summary + FHIR JSON size in KB);
  "Send" → packet card with states Queued → In transit (countdown using profile delay; demo compression shown,
  e.g., "11 min (shown as 11 s)") → Delivered.
- Right: inbox from Earth (flight surgeon replies). Second browser tab with role "Flight surgeon" sees only delivered packets.

### 5.8 Handbook — `/handbook`
- Search box; categories: Signals, Measurements, Hazards, Protocols, About ARGUS.
- Protocol runner: big step cards, timer, "Next" (Space key), step source tags, final "Send summary to Earth".
- Ask box (FR-HELP-2): answers composed from current assessments + handbook entries, shows the entries used,
  otherwise "I don't have that."

### 5.9 Settings & Limits — `/settings`, `/limits`
- Units, theme, glove mode, reduced motion, language (EN only for submission), calibration (screen size, camera FOV).
- Demo controls (FR-SET-2): scenario picker, jump to day, replay SPE, time compression, reset.
- Limits page: what is real / simulated / modeled / experimental, validation table (rPPG), "not a medical device",
  credits.

## 6. 3D body specification (`src/three/`)

- Assets: HRA 3D Reference Organs "united" body sets (Visible Human male/female, CC BY 4.0) from the HRA 3D
  reference library / NIH 3D [SRC_HRA_3D · verified]; optionally BodyParts3D (CC BY 4.0) [SRC_BODYPARTS3D · verified].
  Preprocess with `scripts/build-anatomy.ts` using `@gltf-transform/cli` (weld, simplify to ≤ 150k triangles total,
  meshopt/Draco compress). Keep named nodes for organs used in doc 07 §6.
- Rendering: skin as translucent Fresnel shell (opacity ~0.18, rim light), organs solid with soft emissive tint
  by verdict (NOMINAL organs neutral grey-blue, flagged organs glow watch/act colour, pulsing 1.2 s when ACT).
- Hotspots: small rings with leader labels for regions with any WATCH/ACT; NOMINAL hotspots as subtle dots.
- Camera: OrbitControls with damping; constrained polar angle; region presets; smooth fly-to (450 ms).
- Lens behaviour: when lens = Earth, colours reflect only the Earth layer, etc.
- Scrubber: when the mission day changes, colours tween over 300 ms.
- Fallback: SVG front silhouette with the same regions if WebGL unavailable or `prefers-reduced-motion` + low power.
- Performance: one draw call per organ material group; `frameloop="demand"`; DPR clamp [1, 2].
- Credit caption under the canvas: "Reference body, not a scan of this person: HRA 3D Reference Organs
  (Visible Human), HuBMAP, CC BY 4.0."

## 7. Microcopy rules

- Sentence case. Max 2 sentences per explanation. Numbers with units and comparison.
- Avoid diagnosis words ("you have…"); use observations ("your pulse is higher than usual").
- Verdict words exactly: Nominal, Expected in space, Watch, Act, No data.
- Every demo parameter shows a small "Demo parameter" tag on hover/tap of the number's source badge.

## 8. Accessibility checklist
Keyboard navigation for all flows (PVT uses Space; scrubber arrows; protocol Space/Enter); focus rings `--brand`;
ARIA live region for alerts and countdowns; charts have table alternatives ("View data"); captions on the demo
video; contrast AA verified with axe in Playwright.

## 9. Gamification (operational, not childish)
- Points per completed task (measure 10, exam 25, check-in 5); weekly crew total on Bridge.
- Streaks: daily check-in, weekly reaction test, exercise adherence.
- Badges (icons, not emoji): "Baseline set" (vision), "Clean week" (no overdue), "Night watch" (sleep ≥ 7 h × 3).
- Readiness index (demo formula): 100 − 25·#ACT − 10·#WATCH − 2·#overdue (max −10) − 3·#core daily signals in
  NO DATA (max −15) − 5·(sleep 3-night mean < 5.5 h); clamp 0–100; tooltip shows the formula. #ACT and #WATCH count
  that crew member's own signals (including `radiation_dose`), not cabin signals and not the shelter advisory.
