---
id: measure-camera-pulse
title: Camera pulse
category: measurements
order: 1
signalIds: [heart_rate_rest]
keywords: [camera, webcam, pulse, heart rate, rppg, face, video, measure, privacy, quality]
sourceIds: [SRC_POS_WANG2017, SRC_RPPG_KOSSACK, SRC_MEDIAPIPE_FACE, SRC_DEMO_QUALITY_SCORES, SRC_DEMO_SIMULATION]
summary: Your pulse from the laptop camera in 30 seconds, with a quality score. Video stays on this device.
---

## What it is

ARGUS reads your pulse rate from the camera video of your face with the published POS method (plane-orthogonal-to-skin remote photoplethysmography, rPPG) [SRC_POS_WANG2017]. Among the classical rPPG methods, POS was reported to do best under varying lighting [SRC_RPPG_KOSSACK]. The forehead and cheek regions come from MediaPipe Face Landmarker, which finds 478 face landmarks in the browser [SRC_MEDIAPIPE_FACE].

## How to measure

- Sit still and face the screen.
- Light your face evenly, with no bright light behind you.
- Hold for 30 s [SRC_DEMO_QUALITY_SCORES].
- Breathe normally.

## How ARGUS uses it

- A live estimate appears after 10 s and the result after 30 s [SRC_DEMO_QUALITY_SCORES].
- **Quality score:** good, fair or poor, from five checks: how clear the pulse is in the signal, whether the first and second half agree, movement, lighting and whether your face stayed in view. The worst check sets the label, and all its thresholds are demo parameters [SRC_DEMO_QUALITY_SCORES].
- A poor reading cannot be saved as a normal reading; you can still save it as poor quality for the record. A poor reading raises the verdict no higher than Watch, with the action "Reading quality is poor. Re-measure."
- A fair reading never gives Act on your personal baseline alone; it shows Watch until it is confirmed.
- The result is saved as resting heart rate for the crew member shown in the "Measuring" chip.
- Video stays on this device. Only the number is saved.

## Honest limits

- No paired validation against a reference device has been done yet.
- It does not replace a clinical instrument such as a pulse oximeter or ECG.
- Movement, dim light and light from behind lower the quality.
- The camera measures the person at the laptop, while the demo crew and their baselines are simulated [SRC_DEMO_SIMULATION].

## Sources

- [SRC_POS_WANG2017]
- [SRC_RPPG_KOSSACK]
- [SRC_MEDIAPIPE_FACE]
- [SRC_DEMO_QUALITY_SCORES]
- [SRC_DEMO_SIMULATION]
