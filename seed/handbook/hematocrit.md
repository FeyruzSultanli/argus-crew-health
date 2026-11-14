---
id: hematocrit
title: Hematocrit
category: signals
order: 15
signalIds: [hematocrit]
keywords: [hematocrit, haematocrit, red blood cells, blood, blood count, lab, cbc, rbc]
sourceIds: [SRC_OSD569, SRC_HCT_FLIGHT, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS]
summary: The share of your blood volume made up of red blood cells, from a lab blood count; it rises in flight.
---

## What it is

The share of your blood volume made up of red blood cells, from a lab blood count.

## Why it matters in space

Hematocrit was reported about 10–12 % (relative) higher in flight than before flight, part of it from sample handling delay [SRC_HCT_FLIGHT]. ARGUS counts a rise of up to that size as expected.

## How to measure

- Give a blood sample per the on-board lab procedure.
- The value is entered from the lab result.

## How ARGUS judges it

- **Earth:** the lab reference range printed in the NASA OSDR OSD-569 file, which differs by sex: 38.5–50 % for men and 35–45 % for women [SRC_OSD569]. A value outside it is Watch [SRC_DEMO_RULE_BANDS].
- **Space:** compared with your pre-flight value. No rise is nominal; a rise of up to 12 % (relative) is Expected in space; a larger rise is Watch [SRC_DEMO_RULE_BANDS]. The basis is the reported in-flight rise [SRC_HCT_FLIGHT].
- **Personal:** switched off until the expected in-flight shift is source-verified; otherwise the known rise would be flagged all the time.

## What to do

- **Expected in space:** "Known change in space. Keep doing your countermeasures." [demo wording]
- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]

## Sources

- [SRC_OSD569]
- [SRC_HCT_FLIGHT]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
