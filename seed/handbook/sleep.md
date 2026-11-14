---
id: sleep
title: Sleep duration
category: signals
order: 6
signalIds: [sleep_duration]
keywords: [sleep, sleeping, slept, tired, tiredness, fatigue, sleepy, insomnia, rest, nap, actigraphy, hours]
sourceIds: [SRC_SLEEP_BARGER, SRC_EARTH_SLEEP_7H, SRC_PVT_SPINOFF, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE]
summary: How many hours you slept, judged on the 3-night average; some short sleep is expected in flight.
---

## What it is

How many hours you slept, from a wearable or your own report. ARGUS judges the average of the last three nights.

## Why it matters in space

NASA schedules 8.5 h of sleep, but measured sleep on ISS missions averaged about 6.1 h [SRC_SLEEP_BARGER]. Inadequate sleep and irregular schedules are a NASA human-research risk [SRC_NASA_RISKS]. Some short sleep is expected in flight; ARGUS watches for deeper drops.

## How to measure

- Wear the sleep wearable (actigraphy) overnight, or enter the hours you slept after waking.
- Rate your sleep quality on the five-point scale.

## How ARGUS judges it

- **Earth:** adults are recommended 7 h or more, so the Earth layer says Watch when your 3-night average is below 7 h [SRC_EARTH_SLEEP_7H].
- **Space:** nominal at 7.0 h or more; Expected in space at 5.5–6.9 h ("typical in flight; protect your sleep"); Watch below 5.5 h; Act when the 3-night average is below 5.0 h, or below 5.5 h with a Reaction Self-Test at Watch or Act the same day [SRC_DEMO_RULE_BANDS]. The Watch line sits below the measured in-flight average on purpose, so ordinary in-flight nights are not flagged [SRC_SLEEP_BARGER].
- **Personal:** your average is compared with your own usual, for drops. In flight your usual is shifted down by 0.9 h, and ARGUS never assumes a day-to-day spread smaller than 0.3 h [SRC_DEMO_BASELINE_ENGINE].
- **Earth false alarm:** when Earth says Watch but space says Expected and your personal baseline is fine, the verdict is Expected in space: "Earth would flag this, but it is a known adaptation in space."
- Short sleep at Watch together with a Reaction Self-Test at Watch suggests the Sleep debt protocol. The Reaction Self-Test tells astronauts when their performance drops below optimal [SRC_PVT_SPINOFF].

## What to do

- **Expected in space:** "Known change in space. Keep doing your countermeasures." [demo wording]
- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]
- **Countermeasures:** light, schedule, noise, caffeine timing. [demo wording]

## Sources

- [SRC_SLEEP_BARGER]
- [SRC_EARTH_SLEEP_7H]
- [SRC_PVT_SPINOFF]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
