---
id: mood
title: Mood
category: signals
order: 7
signalIds: [mood]
keywords: [mood, feeling, feelings, low, down, sad, stress, stressed, lonely, isolation, morale, conference]
sourceIds: [SRC_NASA_RISKS, SRC_NASA_HAZARDS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE]
summary: A daily self-rating of how you feel on a five-point scale, with an optional note that only the CMO sees.
---

## What it is

A daily self-rating of how you feel, on a five-point scale from very low to very good, with an optional note.

## Why it matters in space

Isolation and confinement are one of NASA's five hazards [SRC_NASA_HAZARDS], and behavioural changes are a NASA human-research risk [SRC_NASA_RISKS]. Your note is shown only to the CMO; it is never scanned.

## How to measure

- Pick one of the five faces.
- Optionally add one line about today.

## How ARGUS judges it

- **Earth:** no Earth threshold is used, so this layer gives no verdict.
- **Space:** Watch when your 3-day average is 2.5 or lower; Act when it is 1.5 or lower [SRC_DEMO_RULE_BANDS].
- **Personal:** your 3-day average is compared with your own usual, for drops; ARGUS never assumes a day-to-day spread smaller than 0.4 [SRC_DEMO_BASELINE_ENGINE].
- Your note is stored and shown to the CMO, nothing else: ARGUS does not search it for words.

## What to do

- **Watch:** "Tell the CMO. You can ask for a private conference with the flight surgeon." [demo wording]
- **Act:** "Tell the CMO. You can ask for a private conference with the flight surgeon." [demo wording]

## Sources

- [SRC_NASA_RISKS]
- [SRC_NASA_HAZARDS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
