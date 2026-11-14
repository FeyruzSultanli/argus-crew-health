---
id: water-intake
title: Water intake
category: signals
order: 13
signalIds: [hydration]
keywords: [water, drink, drinking, hydration, hydrate, thirsty, fluids, litres, liters, kidney, kidney stone]
sourceIds: [SRC_STD3001_ECLSS, SRC_KIDNEY_STONE_NASA, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE]
summary: How many litres of water you drank in the day, against the NASA provision of at least 2.5 L per day.
---

## What it is

How many litres of water you drank in the day.

## Why it matters in space

NASA provisions at least 2.5 L of water per crewmember per day [SRC_STD3001_ECLSS]. Bone calcium loss and low urine volume raise kidney-stone risk in flight [SRC_KIDNEY_STONE_NASA].

## How to measure

- Enter the total litres you drank today.
- Log at about the same time each day.

## How ARGUS judges it

- **Space and Earth:** Watch when your 2-day average is below 2.0 L [SRC_DEMO_RULE_BANDS], set below the provision of at least 2.5 L per day [SRC_STD3001_ECLSS].
- **Personal:** your 2-day average is compared with your own usual, for drops; ARGUS never assumes a day-to-day spread smaller than 0.2 L [SRC_DEMO_BASELINE_ENGINE].

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_STD3001_ECLSS]
- [SRC_KIDNEY_STONE_NASA]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
