---
id: cabin-co2
title: Cabin CO₂
category: signals
order: 18
signalIds: [cabin_co2]
keywords: [co2, carbon dioxide, air, cabin air, headache, stuffy, ventilation, airflow, mmhg, cabin]
sourceIds: [SRC_STD3001_CO2, SRC_NASA_CO2_PAGE, SRC_CO2_ICES_LIMITS, SRC_OSHA_CO2, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS]
summary: Carbon dioxide in the cabin air against the NASA-STD-3001 limit and the headache-risk evidence.
---

## What it is

The partial pressure of carbon dioxide (CO₂) in the cabin air, in mmHg. It is measured for the cabin, not per person.

## Why it matters in space

NASA-STD-3001 limits the 1-hour average to 3 mmHg; headaches are reported from about 2.8 mmHg [SRC_STD3001_CO2]. Keeping headache risk below 1 % needs a 7-day average below 2.5 mmHg [SRC_NASA_CO2_PAGE].

## How to measure

- Read automatically from the cabin CO₂ sensor.

## How ARGUS judges it

- **Space:** a 1-hour average above 3 mmHg is Watch ("above NASA-STD-3001 limit") [SRC_STD3001_CO2]. A 7-day average of 2.5 mmHg or more is Watch ("headache risk above 1 %") [SRC_NASA_CO2_PAGE]. A level of 6.8 mmHg or more is Act, based on a time-limited exposure band [SRC_CO2_ICES_LIMITS] [SRC_DEMO_RULE_BANDS].
- **Earth:** the workplace limit of 5,000 ppm is about 3.8 mmHg (0.5 %) [SRC_OSHA_CO2] [SRC_NASA_CO2_PAGE], so the Earth layer says Watch only above 3.8 mmHg [SRC_NASA_CO2_PAGE].
- **Missed by Earth:** at 3.4 mmHg the Earth layer says nominal but the space layer says Watch [SRC_STD3001_CO2] [SRC_NASA_CO2_PAGE].
- **Personal:** not used; CO₂ is a cabin value.
- A ticked headache together with a 7-day average of 2.5 mmHg or more suggests the CO₂ headache protocol [SRC_NASA_CO2_PAGE].

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_STD3001_CO2]
- [SRC_NASA_CO2_PAGE]
- [SRC_CO2_ICES_LIMITS]
- [SRC_OSHA_CO2]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
