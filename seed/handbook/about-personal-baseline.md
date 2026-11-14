---
id: about-personal-baseline
title: Your personal baseline
category: about
order: 2
signalIds: []
keywords: [baseline, personal baseline, personal, usual, normal, median, spread, cusum, drift, statistics, z-score, new normal]
sourceIds: [SRC_DEMO_BASELINE_ENGINE, SRC_SLEEP_BARGER, SRC_ALAVI_2022, SRC_MISHRA_2020, SRC_PSU_AI]
summary: How ARGUS learns your usual from your own readings and spots changes that fixed Earth ranges miss.
---

## Why a personal baseline

An Earth reference range is the same for everyone. A reading can stay inside it and still be far from your own usual; that is what the personal layer is for. ARGUS uses plain statistics that a flight surgeon can check by hand, not machine learning. All its tuning constants are demo parameters [SRC_DEMO_BASELINE_ENGINE].

## Your usual: median and spread

- Your daily value is the median of that day's readings.
- Your usual is the median of your daily values, and your spread is the median distance from it, scaled so it can be read like a standard deviation.
- The spread never goes below a floor for each signal, for example 2 bpm for resting heart rate, so a very stable baseline does not turn tiny wobbles into alarms [SRC_DEMO_BASELINE_ENGINE].

## Which reference ARGUS uses

- **Pre-flight:** your readings from mission day −180 to −1 [SRC_DEMO_BASELINE_ENGINE]. Five or more readings make a normal baseline; with 3 or 4 the spread is widened by half and marked "thin baseline"; with fewer than 3 there is no personal verdict yet [SRC_DEMO_BASELINE_ENGINE].
- **Expected shift:** for sleep, your pre-flight usual is lowered by 0.9 h in flight [SRC_DEMO_BASELINE_ENGINE], because measured sleep in flight is shorter than on the ground [SRC_SLEEP_BARGER].
- **In flight:** an adaptive baseline from the last 14 mission days before today on which your personal verdict was Nominal or Expected; it needs at least 7 such days [SRC_DEMO_BASELINE_ENGINE]. Flagged days are left out so that an illness is not learned as normal.
- Signals measured less often than daily never collect enough in-flight days and always use the pre-flight reference.

## Adding up small changes

- **Score:** how many spreads today's value is from your usual, counted in the direction that matters for the signal.
- **CuSum (cumulative sum):** each reading adds its score minus 0.5 to a running total that never goes below zero, so small changes that repeat add up [SRC_DEMO_BASELINE_ENGINE]. Two readings in a row with a score below 1.0 reset the total to zero [SRC_DEMO_BASELINE_ENGINE].
- **Drift:** how far your in-flight usual has moved from your pre-flight usual, in pre-flight spreads.

## From scores to a verdict

- **Watch:** a score of 2.0 or more, a running total of 4.0 or more, a drift of 2.5 or more, or a score of 1.5 or more the day after a Watch or Act [SRC_DEMO_BASELINE_ENGINE].
- **Act:** a score of 3.0 or more on two readings in a row, or a running total of 8.0 or more with a score of 1.5 or more on two readings in a row [SRC_DEMO_BASELINE_ENGINE].
- One reading alone never gives Act, however large it is; a large first reading is Watch with a request to confirm by re-measuring.

## When your normal changes

If a personal Watch lasts 14 days or more with no Act while the space layer is Nominal or Expected, the signal card shows "Persistent shift — review baseline" [SRC_DEMO_BASELINE_ENGINE]. The CMO can tap "Accept as new normal", which is logged with name and date. It never happens automatically.

## Precedent

- Real-time wearable alerting systems for early infection detection compare resting heart rate with each person's own baseline, using a running median and an alerting state machine; CuSum is one of the published detectors [SRC_ALAVI_2022].
- Rises in resting heart rate against the individual baseline detected 63 % of COVID-19 cases before symptoms in a smartwatch study [SRC_MISHRA_2020].
- NASA-funded work is building an AI health display that learns each astronaut's physiology and updates the baseline during the mission [SRC_PSU_AI]. ARGUS uses the transparent, statistical end of that range.

## Sources

- [SRC_DEMO_BASELINE_ENGINE]
- [SRC_SLEEP_BARGER]
- [SRC_ALAVI_2022]
- [SRC_MISHRA_2020]
- [SRC_PSU_AI]
