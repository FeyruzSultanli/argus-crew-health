---
id: about-radiation-space-weather
title: Radiation and space weather
category: about
order: 3
signalIds: [radiation_dose]
keywords: [radiation, space weather, solar, storm, s-scale, proton, flux, noaa, goes, donki, dose, ledger, shelter, replay, alara, msv]
sourceIds: [SRC_NOAA_SWPC_PROTONS, SRC_DONKI, SRC_STD3001_RAD, SRC_ISS_DOSE, SRC_RAD_CURIOSITY, SRC_RAD_CHANGE4, SRC_RAD_MARS_SURFACE, SRC_DEMO_RADIATION_MODEL, SRC_DEMO_SIMULATION]
summary: Live NOAA solar storm levels, your dose ledger against NASA limits, and which radiation numbers are modeled.
---

## Live space weather

ARGUS reads the live 5-minute proton flux of the NOAA GOES satellites [SRC_NOAA_SWPC_PROTONS] and labels it LIVE. The NASA DONKI event list [SRC_DONKI] is currently unavailable in this build. Offline, ARGUS shows the last cached copy with its age, or else a bundled snapshot with its capture date.

## The S-scale

NOAA rates solar radiation storms by the flux of protons above 10 MeV, in pfu (proton flux units) [SRC_NOAA_SWPC_PROTONS]:

- S1 from 10 pfu [SRC_NOAA_SWPC_PROTONS]
- S2 from 100 pfu [SRC_NOAA_SWPC_PROTONS]
- S3 from 1,000 pfu [SRC_NOAA_SWPC_PROTONS]
- S4 from 10,000 pfu [SRC_NOAA_SWPC_PROTONS]
- S5 from 100,000 pfu [SRC_NOAA_SWPC_PROTONS]

A separate alert is on when the flux of protons above 100 MeV reaches 1 pfu [SRC_NOAA_SWPC_PROTONS]. ARGUS waits for several readings in a row above a line before it changes the level.

## Your dose ledger

- **Career before this mission:** a simulated value for each crew member [SRC_DEMO_SIMULATION].
- **Cosmic rays this mission:** a daily dose for the mission profile, taken from published measurements and applied as an assumption: about 0.7 mSv per day on the ISS [SRC_ISS_DOSE], about 1.8 mSv per day in transit [SRC_RAD_CURIOSITY], about 1.37 mSv per day on the lunar surface [SRC_RAD_CHANGE4] and about 0.64 mSv per day on the Mars surface [SRC_RAD_MARS_SURFACE].
- These published values are dose equivalent, while the NASA career limit is an effective dose; the ledger says so.
- **Solar events this mission:** a modeled dose, see below.
- **Limits:** career below 600 mSv and below 250 mSv for a solar particle event, as low as reasonably achievable [SRC_STD3001_RAD]. "Keep exposure as low as reasonably achievable."
- **Verdict:** Watch when the projected end-of-mission dose reaches 80 % of the career limit, Act at 95 %, and Act when the modeled dose of the current event reaches 125 mSv [SRC_DEMO_RADIATION_MODEL].

## Modeled solar-event dose

Turning satellite flux into dose inside a vehicle needs transport codes and vehicle geometry, and ARGUS does not do that. It uses a transparent, illustrative model instead: 0.05 mSv per hour for each pfu above 100 MeV, times a shield factor of 1.0 in normal quarters and 0.3 in the storm shelter, counted only while an event is active [SRC_DEMO_RADIATION_MODEL]. Every such number is labeled "Modeled — illustrative. Real crew dose comes from personal dosimeters."

## Shelter advisory

The shelter advisory is a demo policy [SRC_DEMO_RADIATION_MODEL]:

- **Deep space and the lunar surface:** S1 is Watch ("Prepare shelter. Postpone EVA."), S2 is Act ("Shelter advised."), S3 or higher, or the high-energy alert, is Act ("Shelter now.") [SRC_DEMO_RADIATION_MODEL].
- **Mars surface:** S1 is information only, S2 is Watch, S3 or higher, or the high-energy alert, is Act [SRC_DEMO_RADIATION_MODEL].
- **ISS, inside Earth's magnetic field:** S1 and S2 are information only; S3 or higher, or the high-energy alert, is Watch ("Follow ground radiation team guidance.") [SRC_DEMO_RADIATION_MODEL].
- Real shelter calls come from the mission's radiation specialists.
- The advisory is a cabin-wide banner; it does not change anyone's verdict.

## Replay

When the Sun is quiet, the demo replays a solar event: "REPLAY — synthetic S2-class profile (demo), not a recorded event" [SRC_DEMO_RADIATION_MODEL]. It is never shown as real or live; LIVE belongs only to the current NOAA feed.

## Sources

- [SRC_NOAA_SWPC_PROTONS]
- [SRC_DONKI]
- [SRC_STD3001_RAD]
- [SRC_ISS_DOSE]
- [SRC_RAD_CURIOSITY]
- [SRC_RAD_CHANGE4]
- [SRC_RAD_MARS_SURFACE]
- [SRC_DEMO_RADIATION_MODEL]
- [SRC_DEMO_SIMULATION]
