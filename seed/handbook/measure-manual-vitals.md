---
id: measure-manual-vitals
title: Manual vitals
category: measurements
order: 3
signalIds: [blood_pressure, spo2, body_temp, glucose, body_mass, sleep_duration, mood, symptoms]
keywords: [manual, enter, entry, vitals, blood pressure, oximeter, temperature, glucose, mass, weight, sleep, mood, symptoms, how to measure]
sourceIds: [SRC_TEMPUS_USABILITY, SRC_DEMO_SIMULATION]
summary: One form for blood pressure, oxygen, temperature, glucose, mass, sleep, mood and symptoms, with how-to steps.
---

## What it is

One form for the readings you take with on-board devices: blood pressure, pulse oximetry, temperature, glucose, body mass, sleep, mood and symptoms. Each field has a short "How to measure" card, the kind of step-by-step guidance NASA tested with the Tempus Pro device, where novice users took vital signs easily [SRC_TEMPUS_USABILITY].

## How to measure

- **Blood pressure:** rest 5 min seated (restrained in microgravity), arm supported at heart level, correct cuff size, no talking; take 2 readings 1 min apart, enter the average. [demo wording]
- **Pulse oximetry:** warm finger, no nail polish, keep still 30 s, read when the number is stable. [demo wording]
- **Temperature:** same device and site each time; note if after exercise. [demo wording]
- **Glucose:** wash and dry hands, lancet on the side of a fingertip, first drop on the strip; note fasting or not. [demo wording]
- **Body mass:** use the mass-measurement device per its procedure; same time of day. [demo wording]
- **Sleep:** from the wearable (automatic) or your own report of hours, plus quality 1–5. [demo wording]
- **Mood:** the five-faces scale plus an optional note ("one line about today"). [demo wording]
- **Symptoms:** the symptom checklist. [demo wording]

## How ARGUS uses it

- Each value is saved for the crew member shown in the "Measuring" chip, on the current mission day, and labeled MEASURED.
- When a day has several readings, ARGUS uses their median.
- Your values are compared with that crew member's simulated baseline [SRC_DEMO_SIMULATION].

## Honest limits

- A manual value is only as good as the device and the technique behind it.
- The how-to steps are general practice wording, not a NASA procedure.

## Sources

- [SRC_TEMPUS_USABILITY]
- [SRC_DEMO_SIMULATION]
