---
id: reaction-self-test
title: Reaction Self-Test
category: signals
order: 9
signalIds: [reaction_test]
keywords: [reaction, reaction test, alertness, alert, attention, focus, pvt, lapses, slow, tired, fatigue, cognition]
sourceIds: [SRC_COGNITION, SRC_PVT_SPINOFF, SRC_PVT_B_BASNER2011, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE]
summary: A 3-minute test of how fast you respond to a counter on screen; it also counts slow responses (lapses).
---

## What it is

A 3-minute test of how fast you respond to a counter on screen [SRC_COGNITION]; it also counts slow responses (lapses).

## Why it matters in space

ARGUS models it on NASA's 3-minute PVT-B [SRC_COGNITION], used on the ISS as the Reaction Self-Test to tell astronauts when their performance drops below optimal, for example after poor sleep [SRC_PVT_SPINOFF].

## How to measure

- Use the same device each time.
- Sit somewhere quiet for 3 minutes [SRC_COGNITION].
- Respond as soon as the counter appears; do not press early.

## How ARGUS judges it

- **What is scored:** your mean response speed, your median response time and your lapses. A lapse is a response of 355 ms or slower [SRC_PVT_B_BASNER2011].
- **Earth:** no Earth rule is used, so this layer gives no verdict.
- **Space:** Watch when your lapses are at least 3 more than your pre-flight usual; Act at 6 or more above it [SRC_DEMO_RULE_BANDS]. Your pre-flight usual is the median of your pre-flight runs.
- **Personal:** your response speed is compared with your own usual, for drops; ARGUS never assumes a day-to-day spread smaller than 0.1 responses per second [SRC_DEMO_BASELINE_ENGINE].
- A Reaction Self-Test at Watch together with short sleep at Watch suggests the Sleep debt protocol.

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_COGNITION]
- [SRC_PVT_SPINOFF]
- [SRC_PVT_B_BASNER2011]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
