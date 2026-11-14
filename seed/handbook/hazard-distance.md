---
id: hazard-distance
title: Distance from Earth
category: hazards
order: 3
hazard: distance
signalIds: []
keywords: [distance, earth, delay, comms, communication, communication delay, mars, flight surgeon, ground, autonomy, hazard]
sourceIds: [SRC_NASA_HAZARDS, SRC_NASA_RISKS, SRC_CSA_WHY_SCIENCE, SRC_EIMO, SRC_BME, SRC_DEMO_SIMULATION]
summary: One of NASA's five hazards; far from Earth, help arrives late, so the crew must judge on board.
---

## What it is

Distance from Earth is one of the five hazards of human spaceflight [SRC_NASA_HAZARDS]. Deep-space missions mean communication delay and less reliance on Earth [SRC_CSA_WHY_SCIENCE]. NASA is working toward medical decisions made on board for crews with communication delay [SRC_EIMO].

On the ISS, biomedical flight controllers in Mission Control watch health and environment data in real time and work with the flight surgeon [SRC_BME]. Far from Earth that loop is too slow for a quick answer.

## What ARGUS watches

- No single signal is tagged with this hazard. ARGUS answers it by judging every reading on board, with the action first, and by packing a compact report for the flight surgeon.
- The comms delay shown on a Mars transit is a modeled delay (demo), not derived from a trajectory [SRC_DEMO_SIMULATION].
- Every signal is linked to the NASA human-research risk it belongs to [SRC_NASA_RISKS], so the context is on board without asking Earth.

## Sources

- [SRC_NASA_HAZARDS]
- [SRC_NASA_RISKS]
- [SRC_CSA_WHY_SCIENCE]
- [SRC_EIMO]
- [SRC_BME]
- [SRC_DEMO_SIMULATION]
