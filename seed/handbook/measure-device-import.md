---
id: measure-device-import
title: Device import
category: measurements
order: 5
signalIds: []
keywords: [import, file, csv, json, wearable, device, smart shirt, actigraph, bio-monitor, astroskin, archer, dosimeter]
sourceIds: [SRC_BIOMONITOR, SRC_ARCHER_NASA]
summary: Planned, not in this build — importing CSV or JSON files from wearables; formats like Bio-Monitor or ARCHeR would plug in.
---

## What it is

**Not in this build.** Device import is planned; the Lab shows it as "Coming next". This entry describes the planned flow.

A way to bring readings from wearables and other devices into ARGUS as CSV or JSON files. Imported values are labeled MEASURED and judged by the same three layers as everything else.

## How to measure

- Choose the file.
- Map each column to a signal, its unit and the timestamp.
- Check the preview and any rows listed with errors.
- Import.

## How ARGUS uses it

- Formats like CSA's Bio-Monitor smart shirt or the ARCHeR actigraph would plug in here via an adapter.
- Bio-Monitor records heart activity, blood pressure, breathing, SpO₂, skin temperature and activity [SRC_BIOMONITOR]. ARCHeR measures motion, sleep patterns and light exposure [SRC_ARCHER_NASA].
- Wearable skin temperature is shown as a trend only, never judged as body temperature.

## Honest limits

- No live device adapter is built; files are mapped by hand.
- The sample files shipped with ARGUS are synthetic and their format is illustrative.

## Sources

- [SRC_BIOMONITOR]
- [SRC_ARCHER_NASA]
