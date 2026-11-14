# Speaker notes — ARGUS deck (7 slides)

From `docs/submission/SLIDES.md`. Variant B (no paired camera-pulse validation) on slide 4.

**1 — ARGUS — Crew Health Autonomy.** ARGUS lets an astronaut measure, understand and act on their own health without
waiting for Earth. It is a working offline web app; the crew in it is simulated, the space-weather data and the
measurements are real.

**2 — Far from Earth, "normal" is not enough.** On a Mars mission the crew cannot wait for a ground loop. Fixed Earth
thresholds raise false alarms for normal space adaptations and miss changes that matter for one person. And today's
checks are periodic, with separate devices.

**3 — Every reading judged three ways.** This is the one thing fixed-threshold dashboards cannot show. Her pulse is
normal on any lab sheet, but eleven beats above her own normal for three days, with her temperature up too; ARGUS
flags it and opens the suspected-infection protocol. Wearable studies use the same personal-baseline idea.

**4 — Measure with what's on board.** ARGUS measures with hardware the crew already carries. The camera result always
comes with a quality score and a retake path; we do not claim clinical accuracy. The vision test is designed and its
rules exist, but the screen test is the next step, not part of this build.

**5 — Space weather, dose and cabin air.** The radiation panel reads real NOAA data and works offline from a cached
copy. For the demo we replay a synthetic storm because no real event happened in the seven days before the build; it
is labeled on every card. Real crew dose comes from dosimeters and real shelter calls from radiation specialists.

**6 — Standards-traced, FHIR-ready, offline.** Every threshold on screen links to its source with a verified, partial
or demo label. The export uses the shape a crew health data platform can read, and the flight surgeon only sees what
has arrived over the delayed link. The honesty table is in the app itself, on the Limits page.

**7 — Decisions on board, when Earth is minutes away.** Most entries check readings against fixed thresholds. ARGUS asks a better question: is this unusual for
this astronaut, in this environment, and can we trust the measurement? And it measures with hardware already on
board. Do not claim it is clinically more accurate: the crew data is simulated, some thresholds are demo parameters,
the camera pulse has not been compared with a reference device and the face scan is experimental. The claim is a
better question and honest labels, not a better diagnosis. What it needs next is validation against reference
devices and a clinical review. Scan the code to try it; the demo PIN is 2026.
