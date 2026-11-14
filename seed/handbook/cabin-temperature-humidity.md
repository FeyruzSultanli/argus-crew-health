---
id: cabin-temperature-humidity
title: Cabin temperature and humidity
category: signals
order: 19
signalIds: [cabin_temp, cabin_humidity]
keywords: [cabin temperature, cabin, temperature, humidity, hot, cold, warm, dry, damp, comfort, air]
sourceIds: [SRC_STD3001_ECLSS, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS]
summary: Cabin air temperature and relative humidity against the NASA-STD-3001 performance zone and health limits.
---

## What it is

The temperature and the relative humidity of the cabin air. They are measured for the cabin, not per person.

## Why it matters in space

NASA-STD-3001 sets a performance zone of 20–25 °C and 30–60 % relative humidity, and health limits of 18–27 °C, for the cabin [SRC_STD3001_ECLSS].

## How to measure

- Read automatically from the cabin sensor.

## How ARGUS judges it

- **Temperature:** nominal in the performance zone of 20–25 °C; Watch outside it but within the health limits of 18–27 °C; Act outside 18–27 °C [SRC_STD3001_ECLSS].
- **Humidity:** nominal at 30–60 % [SRC_STD3001_ECLSS]; Watch at 25–29 % or 61–75 %; Act below 25 % or above 75 % [SRC_DEMO_RULE_BANDS]. These humidity bands are a demo simplification of the standard's temperature–humidity zone [SRC_STD3001_ECLSS].
- **Personal:** not used; these are cabin values.

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_STD3001_ECLSS]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
