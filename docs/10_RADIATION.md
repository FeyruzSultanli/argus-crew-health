# 10 — Radiation & environment

Space radiation is described by NASA as one of the most hazardous aspects of spaceflight [SRC_NASA_HAZARDS];
CSA notes neutrons contribute about 30 % of total radiation on the ISS [SRC_CSA_RADIATION]. ARGUS gives the
crew real-time situational awareness from **live public data**, a **dose ledger** against NASA-STD-3001 limits,
and a **shelter advisory** — while being explicit that real radiation calls come from NASA's specialist
radiation team on the ground.

## 1. Live data sources

| Feed | Endpoint | Notes |
|------|----------|-------|
| GOES integral protons (primary satellite) | `https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json` (also `-6-hour`, `-3-day`, `-7-day`) | 5-min data; fields include `time_tag`, `satellite`, `flux`, `energy` (e.g. `">=10 MeV"`, `">=100 MeV"`) [SRC_NOAA_SWPC_PROTONS · verified] |
| NASA DONKI SEP events | `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (no key) or `https://api.nasa.gov/DONKI/SEP?startDate=…&endDate=…&api_key=DEMO_KEY` | default window = last 30 days; fields `sepID`, `eventTime`, `instruments[]` (objects with `displayName`, to be mapped to strings), `linkedEvents[]`, `link` [SRC_DONKI · verified] — field shapes were not re-checked in the pre-build review: inspect one live response first |

**First task:** check CORS for both endpoints from the browser (or from a terminal:
`curl -sI -H "Origin: http://localhost:5173" "<url>" | grep -i access-control-allow-origin`). If blocked, add a
tiny Vercel function `api/proxy-swpc.ts` / `api/proxy-donki.ts` (allow-listed URLs only, 60-s cache) and
document it. Never ship an API key in client code; DONKI via CCMC needs none.

Parsing: tolerate missing/negative fluxes (filter `flux > 0`), duplicate satellites, out-of-order times.
Normalise to `ProtonSample` (doc 06 §4).

## 2. NOAA S-scale and alerts [SRC_NOAA_SWPC_PROTONS · verified]

| S level | ≥10 MeV integral flux (pfu) |
|---------|-----------------------------|
| S1 | ≥ 10 |
| S2 | ≥ 100 |
| S3 | ≥ 1,000 |
| S4 | ≥ 10,000 |
| S5 | ≥ 100,000 |

`s100Alert` = ≥100 MeV flux ≥ 1 pfu. NOAA requires sustained exceedance for official event thresholds; for display
we use the latest 3 consecutive 5-min points all ≥ threshold (debounce).

## 3. Mission profiles — environment parameters (`seed/missions.json`)

| Profile | Gravity | One-way delay | Baseline GCR dose rate (mSv/day) | Source status |
|---------|---------|---------------|----------------------------------|---------------|
| ISS (LEO) | 0 | < 1 s | 0.7 (range ≈ 0.5–0.8) | verified: 0.73 mSv/day dose equivalent reported for the ISS [SRC_ISS_DOSE] |
| Lunar transit (Orion-class) | 0 | ~1.3 s (Earth–Moon distance ÷ c) | 1.8 | value verified [SRC_RAD_CURIOSITY]; it is a Mars-cruise measurement behind spacecraft shielding, applied here to a lunar transit as an assumption |
| Lunar surface base | 0.165 | ~1.3 s | 1.37 | verified [SRC_RAD_CHANGE4] |
| Pressurized rover (lunar) | 0.165 | ~1.3 s | 1.37 | verified [SRC_RAD_CHANGE4]; rover shielding not modeled |
| Mars transit | 0 | demo profile 0 → ~16.7 min over 210 days (see below) | 1.8 | verified [SRC_RAD_CURIOSITY] |
| Mars surface base | 0.38 | ≈ 3–22 min by planetary geometry; fixed 12 min in demo | 0.64 | verified [SRC_RAD_MARS_SURFACE] |

These are measured dose-equivalent rates; the 600 mSv limit is a NASA effective dose. Label the ledger "dose
equivalent, published measurements" so the two quantities are not presented as the same thing.

Light-time for the fixed profiles is physics (distance / speed of light) — label "computed". The Mars transit delay
table is a **demo profile, not derived from a trajectory**: on a 210-day transfer the geometric one-way light-time
would be nearer 5 minutes on day 143 and 10 minutes at arrival. Show it as "modeled delay (demo)" in the mission
chip, cite `SRC_DEMO_SIMULATION`, and say "modeled" if a judge asks. Mars transit delay table (modeled, demo):
`[[1, 1], [60, 120], [120, 420], [143, 660], [210, 1000]]` seconds, linear interpolation. Mission day 143 → 11 min
(matches the demo story). Gravity values: Moon ≈ 1/6 g, Mars 3/8 g [SRC_NASA_HAZARDS for Mars 3/8].

## 4. Dose ledger (`domain/radiation/doseLedger.ts`)

```
careerPre      = crew.careerDoseMsvPreMission            (simulated, labeled)
missionGcr     = Σ_days profile.gcrDoseMsvPerDay          (or dosimeter import if present → overrides)
missionSpe     = Σ modeled SPE increments                 (see §5; labeled "modeled")
total          = careerPre + missionGcr + missionSpe
pctCareer      = total / 600 mSv                           [SRC_STD3001_RAD · verified, V1 4030]
projectedEnd   = total + remainingDays · gcrRate
speThisEvent   = modeled dose since event start            vs 250 mSv design limit [SRC_STD3001_RAD, V1 4031]
```
Verdicts (doc 07 §4.20): WATCH projectedEnd ≥ 80 % of 600; ACT ≥ 95 %; ACT if speThisEvent ≥ 125 mSv. All demo.
With the seed values two crew are WATCH on Mars transit from day 1 to the end (R. Vance: projected 498 mSv = 83 %;
L. Duarte, the CMO: 558 mSv = 93 %). Keep that as a deliberate radiation showcase, or lower
`careerDoseMsvPreMission` in `seed/crew.json` — a team decision to take before the build. Show mSv with one decimal
and the modeled SPE dose of the current event with two decimals: an S2 replay adds well under 1 mSv, which would
be invisible on a 600-mSv bar.
Always show ALARA note: "Keep exposure as low as reasonably achievable." [V1 4029]

## 5. Modeled SPE dose (illustrative only)

Converting GOES flux at 1 AU into dose inside a vehicle needs transport codes and vehicle geometry; we do **not**
pretend to do that. For the demo, a transparent illustrative model:

```
doseRate_mSv_per_h = K × flux≥100MeV_pfu × shieldFactor
K = 0.05 (demo) ; shieldFactor = 1.0 normal quarters, 0.3 in storm shelter (demo)
```
**Event gating.** Integrate the modeled dose only while an event is active: from the first sample at which the
debounced S-scale is ≥ S1 (or `s100Alert` is true) until the debounced S-scale is back at S0. Outside an event the
modeled SPE dose rate is 0. (The quiet-time ≥100 MeV channel reads roughly 0.1–0.2 pfu of background; integrating
it all the time would add about 0.2 mSv per day of dose that no event produced.) `speThisEvent` is the integral
over the current or most recent event; `missionSpe` is the sum over all events.
UI label on every modeled number: "Modeled — illustrative. Real crew dose comes from personal dosimeters."
If a dosimeter CSV is imported (`seed/import-samples/dosimeter-sample.csv` format), use it instead.

## 6. Shelter advisory (demo policy, `domain/radiation/shelter.ts`)

| Profile class | S1 | S2 | S3+ or s100Alert |
|---------------|----|----|------------------|
| Deep space (lunar transit, Mars transit) & lunar surface/rover | WATCH: "Prepare shelter. Postpone EVA." | ACT: "Shelter advised." | ACT: "Shelter now." |
| Mars surface | info | WATCH | ACT |
| ISS (inside magnetosphere) | info | info | WATCH: "Follow ground radiation team guidance." |

Copy always ends with: "Real shelter calls come from the mission's radiation specialists."

## 7. Offline behaviour (FR-RAD-3)

1. Try live (3-s timeout) → store in Dexie `spaceWeather` with `fetchedAt`.
2. Else latest cached → mode `CACHED`, show age ("2 h old").
3. Else bundled `seed/radiation/goes-snapshot.json` → mode `SNAPSHOT`, show capture date.
4. Polling: every 5 min while the Environment screen is visible; every 15 min otherwise; never when offline.

## 8. Replay mode (FR-RAD-4)

Goal: show a real solar particle event in the 30-s video even if the sun is quiet on demo day.
1. `scripts/fetch-data.ts` saves today's 7-day GOES file. If it contains an event (≥10 MeV ≥ 10 pfu), save that
   window as `seed/radiation/spe-replay.json` with source "NOAA SWPC GOES, captured <date>".
2. Otherwise (the usual case when the Sun is quiet) write the **synthetic S2 profile** below to the same file with
   `"synthetic": true`. Do not spend time looking for an event list. All of its numbers are demo parameters
   [SRC_DEMO_RADIATION_MODEL · demo]; label it "REPLAY — synthetic S2-class profile (demo), not a recorded event".
   5-minute samples over 36 h. ≥10 MeV: background 0.2 pfu; from t = 0.5 h an exponential rise to a peak of 150 pfu
   at t = 3 h; then exponential decay with an e-folding time of 10 h. ≥100 MeV: background 0.15 pfu; same timing;
   peak 0.8 pfu (it stays under the 1-pfu alert, so the advisory reads "Shelter advised", as in the demo story).
   Never call this profile "real" or "live" in the UI, the video or the slides; LIVE belongs only to the current
   NOAA feed.
3. Replay speeds 60× / 600× / 3600× from the demo controls, default **600×** (10 h of event per minute; S2 is
   reached about 20 s after pressing play, about 3 s at 3600×). S-scale, shelter advisory and modeled SPE dose
   update as it plays.

## 9. Cabin environment (FR-RAD-7)

Simulated sensor stream per mission day (5-min resolution for the last 24 h, daily means otherwise):
- ppCO₂ (mmHg): 1-h average vs ≤ 3 mmHg [SRC_STD3001_CO2 · verified]; 7-day average vs 2.5 mmHg headache-risk line
  [SRC_NASA_CO2_PAGE · verified]; ACT ≥ 6.8 mmHg [SRC_CO2_ICES_LIMITS · partial]. Earth comparison line 3.8 mmHg
  (0.5 %) [SRC_NASA_CO2_PAGE].
- Temperature and humidity vs performance zone 20–25 °C / 30–60 % RH and health limits 18–27 °C
  [SRC_STD3001_ECLSS · verified].
- Scenario "CO₂ spike": days 118–122 rise to 3.4–4.2 mmHg (sleep-station pocket), crew headaches reported.

## 10. UI (see doc 11 §5.5)
Proton flux log-scale chart with S-threshold lines; current S-level tile; shelter advisory banner; DONKI event list;
dose ledger per crew (stacked bar: career pre-mission / mission GCR / mission SPE modeled) with 600 mSv line;
CO₂ gauge + 7-day sparkline; temperature/humidity comfort zone plot.
