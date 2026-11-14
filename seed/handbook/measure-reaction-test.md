---
id: measure-reaction-test
title: Taking the Reaction Self-Test
category: measurements
order: 2
signalIds: [reaction_test]
keywords: [reaction, reaction test, pvt, alertness, test, lapses, false start, keyboard, measure, tired]
sourceIds: [SRC_COGNITION, SRC_PVT_SPINOFF, SRC_PVT_B_BASNER2011, SRC_DEMO_QUALITY_SCORES]
summary: How the 3-minute Reaction Self-Test works, how it is scored and why you should use the same device.
---

## What it is

A 3-minute test modeled on NASA's PVT-B (psychomotor vigilance test), part of the Cognition battery developed for NASA [SRC_COGNITION]. On the ISS it is called the Reaction Self-Test and tells astronauts when their performance drops below optimal [SRC_PVT_SPINOFF]. A counter appears at random intervals of 1–4 s [SRC_PVT_B_BASNER2011].

## How to measure

- Use the same device each time.
- Sit somewhere quiet for 3 minutes [SRC_COGNITION].
- Respond as soon as the counter appears: press Space, any key, or the large button.
- Do not press early.

## How ARGUS uses it

- A response of 355 ms or slower is a lapse [SRC_PVT_B_BASNER2011].
- A response faster than 100 ms, or a press with no counter on screen, is a false start; this is the usual PVT convention, not re-checked at source [SRC_DEMO_QUALITY_SCORES].
- No response within 30 s counts as a lapse [SRC_DEMO_QUALITY_SCORES].
- ARGUS reports your median response time, mean response speed, lapses and false starts, and judges speed and lapses against your own pre-flight runs.
- If you switch away from the test it pauses; away for more than 2 s, it stops and nothing is saved [SRC_DEMO_QUALITY_SCORES].
- Your first run ever is marked as practice.

## Honest limits

- Response times depend on the device; use the same device for comparable results.
- It is modeled on the NASA test; it is not the NASA software.

## Sources

- [SRC_COGNITION]
- [SRC_PVT_SPINOFF]
- [SRC_PVT_B_BASNER2011]
- [SRC_DEMO_QUALITY_SCORES]
