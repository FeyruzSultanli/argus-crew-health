# 08 — Personal baseline engine

Goal: answer *"is this unusual for this astronaut?"* with transparent statistics that a flight surgeon can
audit by hand. No machine learning (no in-flight training data exists publicly; a model trained on our own
simulation would only learn our simulation).

**Precedent.** Real-time wearable alerting systems for early infection detection compare resting heart rate
to each person's own baseline (streaming median) and raise alerts through a state machine; CuSum on resting
heart rate is one of the published online detectors [SRC_ALAVI_2022 · verified], [SRC_MISHRA_2020 · verified].
NASA-funded work is building AI early-warning displays that learn each astronaut's baseline and update it
during the mission [SRC_PSU_AI · verified]. ARGUS uses the transparent, statistical end of that spectrum.
All tuning constants below are **demo parameters** (label them in the UI).

## 1. Definitions

For one crew member *c* and signal *s* with concerning direction *d* ∈ {up, down, both}:

- Daily value `x_t`: median of that mission day's readings (for sleep/mood: the day's single value; for
  sleep the verdict uses the 3-night mean, computed before the engine).
- Robust centre: `median(X)`. Robust spread: `MAD(X) = median(|x − median(X)|)`.
- Robust sigma: `σ = max(1.4826 · MAD, sigmaFloor_s)` (1.4826 makes MAD consistent with SD for normal data;
  the floor stops a very stable baseline from turning tiny wobbles into alarms).

## 2. Reference selection

1. **Pre-flight baseline** `B_pre = (m_pre, σ_pre)` from readings with missionDay ∈ [−180, −1].
   - n ≥ 5 → normal. 3 ≤ n < 5 → σ_pre ×= 1.5 and quality note "thin baseline". n < 3 → personal layer NO_DATA.
2. **Expected spaceflight shift** (optional per signal): `m_pre' = m_pre + expectedShift(ctx)` where ctx includes
   mission day and gravity. Default 0. Any non-zero shift must cite a source.
3. **Adaptive in-flight baseline** `B_ad = (m_ad, σ_ad)` from the last 14 mission days *before* today whose
   personal verdict was NOMINAL or EXPECTED (flagged days are excluded so illness is not learned as normal).
   Requires ≥ 7 such days; σ_ad = max(1.4826 · MAD, sigmaFloor_s). Only in-flight days (missionDay ≥ 1) count.
   Signals measured less often than daily never collect 7 readings in 14 days and therefore always use the
   pre-flight reference — this is intended.
4. Reference for today: `ref = B_ad` if available, else `(m_pre', σ_pre)`.

## 3. Scores

- Signed score for direction: `z_t = (x_t − ref.m) / ref.σ` for *up*; `z_t = (ref.m − x_t) / ref.σ` for *down*;
  for *both* compute both (see "Direction `both`" below).
- One-sided CuSum (per direction): `S_0 = 0`, `S_t = max(0, S_{t−1} + z_t − k)` with **k = 0.5**.
  Start at the first in-flight day with a valid reference.
  **Recovery reset:** when `z_t < 1.0` on two consecutive readings, set `S_t = 0` (the excursion is over). Without
  this the sum would keep a signal flagged for weeks after the values are back to normal.
- **The index t counts readings, not calendar days.** `t−1` is the previous day that has a value for this signal;
  z, S and the state carry over days without a reading.
- **Direction `both`:** run z, CuSum and the state machine separately for *up* and for *down* and report the worse
  state together with its direction. Never combine an *up* z with a *down* z or CuSum.
- **Comparisons:** round z, S and drift to 2 decimals before applying the thresholds (in IEEE doubles
  (7.1 − 0.9 − 5.3) / 0.3 is 2.9999999999999982, and TV-4b expects 3.0).
- **Drift check** (only when B_ad exists): `drift = (m_ad − m_pre') / σ_pre` signed by direction.

## 4. State machine (per day)

```
ACT   if (z_t ≥ 3.0 AND z_{t−1} ≥ 3.0)                     // sustained large deviation
       OR (S_t ≥ 8.0 AND z_t ≥ 1.5 AND z_{t−1} ≥ 1.5)      // accumulated drift that is still present today
WATCH if z_t ≥ 2.0
       OR S_t ≥ 4.0
       OR drift ≥ 2.5                          // "your in-flight normal has drifted from pre-flight"
       OR (state_{t−1} ∈ {WATCH, ACT} AND z_t ≥ 1.5)   // hysteresis: don't flap
NOMINAL otherwise
A single first reading with z_t ≥ 3.0 is WATCH with action "confirm with a re-measure" (never ACT on one point).
Both ACT branches need z_{t−1}, so one reading alone can never give ACT however large it is. Once the value is back
to normal the state drops to WATCH (while S_t ≥ 4.0) and to NOMINAL after the recovery reset (TV-9, TV-10).
```

**Persistent-shift guard (human in the loop).** Because flagged days are excluded from the adaptive baseline, a
genuine permanent change could keep a signal in WATCH forever. If personal WATCH persists ≥ 14 consecutive days
with no ACT and the space layer is NOMINAL/EXPECTED, the signal card shows "Persistent shift — review baseline".
The CMO can tap **Accept as new normal** (logged with name and date): the adaptive window then restarts from the
next day including those values. Never automatic.

## 5. Explanation templates (FR-BAS-5)

| Case | Template |
|------|----------|
| z-driven | "{label} is {Δ} {unit} {above/below} your usual ({ref.m} {unit}). That is {z:.1f}× your normal day-to-day variation." |
| CuSum-driven | "{label} has been {higher/lower} than your usual for {n} days in a row. Small changes are adding up." |
| drift | "Your in-flight {label} has settled {Δ} {unit} {above/below} your pre-flight normal." |
| nominal | "Within your usual range ({lo}–{hi} {unit})." where lo/hi = ref.m ∓ 2·ref.σ |
| no baseline | "Not enough readings yet to know your usual. {k} more needed." |

Numbers object for the UI/debug drawer: `{ ref, sigma, z, cusum, drift, nPre, nAdaptive, referenceKind }`.

## 6. Band for charts (FR-BAS-6)
Personal band per day = `ref.m ± 2·ref.σ` (shaded), pre-flight band dashed, and the space-expected band
(if expectedShift ≠ 0) in a different tint.

## 7. Per-signal parameters

| signal | direction | sigmaFloor | aggregation | notes |
|--------|-----------|------------|-------------|-------|
| heart_rate_rest | both (primary up) | 2 bpm | daily median | |
| blood_pressure.systolic | up | 5 mmHg | daily median | |
| blood_pressure.diastolic | up | 4 mmHg | daily median | |
| spo2 | down | 1 % | daily median | |
| body_temp | up | 0.2 °C | daily max | |
| glucose (fasting) | both | 5 mg/dL | single | |
| sleep_duration | down | 0.3 h | 3-night mean | in-flight expectedShift −0.9 h (pre-flight ~7 h vs measured ~6.1 h in flight, SRC_SLEEP_BARGER; derivation is a demo parameter) |
| mood | down | 0.4 | 3-day mean | |
| body_mass | down | 0.5 kg | single | |
| reaction_test (speed) | down | 0.1 s⁻¹ | single | |
| near_acuity | up | 0.05 logMAR | per eye | |
| hydration | down | 0.2 L | 2-day mean | |
| hematocrit | both | 1 % | single | personal layer **disabled** until an expected in-flight shift is source-verified (otherwise the known rise would flag permanently) |
| wbc | both | 0.4 ×10³/µL | single | personal layer **disabled** (space rule ±40 % handles it) |

## 8. Test vectors (must be unit tests in `src/domain/baseline/__tests__/`)

**TV-1 Robust stats.** Pre-flight resting HR `[58, 60, 59, 61, 57, 60, 59]`, floor 2 →
median 59, MAD 1, 1.4826·MAD = 1.48 → **σ = 2** (floor wins).

**TV-2 CuSum and states.** Reference (59, 2), k = 0.5, adaptive baseline not yet available. In-flight daily
values `[60, 61, 63, 64, 65, 66, 67]`:

| day | x | z | S | state | why |
|-----|---|---|---|-------|-----|
| 1 | 60 | 0.5 | 0.0 | NOMINAL | |
| 2 | 61 | 1.0 | 0.5 | NOMINAL | |
| 3 | 63 | 2.0 | 2.0 | WATCH | z ≥ 2 |
| 4 | 64 | 2.5 | 4.0 | WATCH | z ≥ 2, S ≥ 4 |
| 5 | 65 | 3.0 | 6.5 | WATCH | first z ≥ 3 → confirm |
| 6 | 66 | 3.5 | 9.5 | ACT | z ≥ 3 twice; S ≥ 8 |
| 7 | 67 | 4.0 | 13.0 | ACT | |

**TV-3 Floor dominates constant data.** `[100,100,100,100,100]`, floor 5 → median 100, MAD 0, **σ = 5**.

**TV-4 Down direction with expected shift.** Sleep pre-flight `[7.2, 6.9, 7.5, 7.0, 7.1]`, floor 0.3 → median 7.1,
MAD 0.1, σ = 0.3; in-flight expectedShift −0.9 → reference 6.2 h (no adaptive baseline yet).
- **TV-4a** 3-night mean 6.2 → z_down = 0 → personal NOMINAL; space 6.2 h → EXPECTED; Earth < 7 h → WATCH →
  adaptation downgrade → combined **EXPECTED**, drivenBy [space] ("Earth would flag this, but it is a known adaptation").
- **TV-4b** 3-night mean 5.3 → z_down = 3.0 → personal WATCH (single point); space < 5.5 → WATCH; Earth WATCH →
  combined **WATCH**, drivenBy [personal, space, earth], caughtOnlyByPersonal = false.
- **TV-4c** expectedShift disabled, 3-night mean 6.2 → z_down = 3.0 → personal WATCH; combined WATCH (shows why the
  shift matters).

**TV-5 Drift.** m_pre' = 59, σ_pre = 2, adaptive median m_ad = 64 → drift = 2.5 → **WATCH** with drift explanation,
even if today's z vs adaptive reference is ~0.

**TV-6 Thin baseline.** Pre-flight n = 3 `[70, 72, 71]`, floor 2 → MAD 1 → 1.48 → σ = max(1.48, 2) = 2 → ×1.5 → **σ = 3**,
quality note "thin baseline".

**TV-7 Exclusion of flagged days (pure-function test).** Call the adaptive-window function directly with 14
in-flight daily values and a given verdict history in which days 5–7 are ACT and the other 11 are NOMINAL: the
baseline must be computed from those 11 values only. Do not try to produce this history through the state machine
(ACT on day 5 needs an elevated day 4, and the days after an excursion are WATCH until the recovery reset).

**TV-8 Showcase (scenario "silent infection" of the seed).** K. Osei: reference median 58, σ 2 (adaptive
baseline from days 127–140, all nominal around 58). Days 141–143 RHR 63, 68, 69 (all inside Earth's 60–100
range → Earth NOMINAL, space NOMINAL):

| day | x | z | S (k=0.5, S₁₄₀=0) | personal |
|-----|---|---|-------------------|----------|
| 141 | 63 | 2.5 | 2.0 | WATCH |
| 142 | 68 | 5.0 | 6.5 | WATCH (previous z < 3, S < 8) |
| 143 | 69 | 5.5 | 11.5 | **ACT** |

→ day 143 combined verdict ACT, drivenBy [personal], **caughtOnlyByPersonal = true**.

**TV-9 Recovery and reset.** Continue TV-8 with days 144–146 = 58, 58, 58 (z = 0; reference still (58, 2)):

| day | x | z | S | personal | why |
|-----|---|---|---|----------|-----|
| 144 | 58 | 0.0 | 11.0 | WATCH | S ≥ 4; not ACT because z < 1.5 |
| 145 | 58 | 0.0 | 0.0 | NOMINAL | second reading in a row with z < 1.0 → S reset to 0 |
| 146 | 58 | 0.0 | 0.0 | NOMINAL | |

**TV-10 One outlier never gives ACT.** Reference (59, 2), no adaptive baseline, in-flight values `[59, 77, 59, 59]`:

| day | x | z | S | state | why |
|-----|---|---|---|-------|-----|
| 1 | 59 | 0.0 | 0.0 | NOMINAL | |
| 2 | 77 | 9.0 | 8.5 | WATCH | S ≥ 8 but z_{t−1} < 1.5 → a single point |
| 3 | 59 | 0.0 | 8.0 | WATCH | S ≥ 4; not ACT because z < 1.5 |
| 4 | 59 | 0.0 | 0.0 | NOMINAL | recovery reset |
