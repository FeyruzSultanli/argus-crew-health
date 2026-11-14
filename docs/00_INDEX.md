# ARGUS documentation — index and reading order

| # | Document | What it covers |
|---|----------|---------------------|
| 01 | [Product vision](01_PRODUCT_VISION.md) | the "why", the story, the judging strategy |
| 02 | [NASA baseline systems](02_NASA_BASELINE.md) | what NASA actually uses, and what we mirror |
| 03 | [Competitive analysis](03_COMPETITIVE_ANALYSIS.md) | what we must beat and how |
| 04 | [Requirements](04_REQUIREMENTS.md) | the numbered requirements |
| 05 | [Architecture](05_ARCHITECTURE.md) | stack, folders, data flow, boundaries |
| 06 | [Data model](06_DATA_MODEL.md) | types, units, validation ranges, FHIR export |
| 07 | [Clinical rules & signal catalog](07_CLINICAL_RULES.md) | the 3-layer evaluation |
| 08 | [Personal baseline engine](08_BASELINE_ENGINE.md) | the statistics, with test vectors |
| 09 | [Measurement Lab](09_MEASUREMENT_LAB.md) | camera pulse (rPPG), vision check, Reaction Self-Test, face scan |
| 10 | [Radiation & environment](10_RADIATION.md) | NOAA/DONKI ingestion, dose model |
| 11 | [UI/UX specification](11_UI_UX_SPEC.md) | design system, every screen |
| 12 | [Datasets & sources](12_DATASETS_AND_SOURCES.md) | what to download, licenses |
| 14 | [QA & verification](14_QA_AND_VERIFICATION.md) | test plan, fact-check, demo rehearsal |
| — | [submission/](submission/) | the 7-slide deck and the screenshots |
| — | [Project rules](PROJECT_RULES.md) | honesty, privacy and code rules |
| — | [Decisions register](DECISIONS.md) | decisions and deviations from the specification, numbered |
| — | `../seed/sources.json` | the single registry of every cited fact |

Living files: `docs/DECISIONS.md`, `CREDITS.md`.

## Glossary

| Term | Meaning |
|------|---------|
| CMO | Crew Medical Officer — crew member trained (not a physician) to deliver care on board |
| Flight surgeon | Physician on Earth supporting the crew, reached through the delayed Earth link |
| BME | Biomedical Engineer flight controller in Mission Control (NASA) |
| CHeCS | Crew Health Care System — the ISS medical, environmental and countermeasure hardware suite |
| CHP-IDSP | NASA's Crew Health and Performance Integrated Data System Platform (in development) |
| MDA | NASA Medical Data Architecture project (predecessor test beds of CHP-IDSP) |
| IMM | NASA Integrated Medical Model — probabilistic model over 100 spaceflight medical conditions |
| SANS | Spaceflight Associated Neuro-ocular Syndrome |
| SPE / SEP | Solar Particle Event / Solar Energetic Particles |
| pfu | particle flux unit = protons · cm⁻² · s⁻¹ · sr⁻¹ |
| rPPG | remote photoplethysmography — pulse from subtle skin colour changes in video |
| PVT-B | 3-minute Psychomotor Vigilance Test (NASA "Reaction Self-Test") |
| MET / mission day | Mission elapsed time; mission day 1 = launch day |
| L-n / R+n | n days before launch / after return |
| Verdict | Combined status of a signal: NOMINAL, EXPECTED, WATCH, ACT, NO DATA |
