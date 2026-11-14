---
id: white-blood-cells
title: White blood cells
category: signals
order: 16
signalIds: [wbc]
keywords: [white blood cells, wbc, immune, immunity, blood count, lab, cbc, leukocytes, infection, rash]
sourceIds: [SRC_OSD569, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS]
summary: The number of white blood cells, the immune system's cells, from a lab blood count.
---

## What it is

The number of white blood cells, the immune system's cells, from a lab blood count.

## Why it matters in space

The immune system changes in flight, and dormant viruses can reactivate, for example as rashes [SRC_NASA_RISKS].

## How to measure

- Give a blood sample per the on-board lab procedure.
- The value is entered from the lab result.

## How ARGUS judges it

- **Earth:** the lab reference range of the NASA OSDR OSD-569 file, 3.8–10.8 ×10³ per µL [SRC_OSD569]. A value outside it is Watch [SRC_DEMO_RULE_BANDS].
- **Space:** Watch when your count is more than 40 % above or below your own pre-flight count [SRC_DEMO_RULE_BANDS]. The context is the immune change in flight [SRC_NASA_RISKS].
- **Personal:** switched off; the space rule compares you with your own pre-flight count.

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]

## Sources

- [SRC_OSD569]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
