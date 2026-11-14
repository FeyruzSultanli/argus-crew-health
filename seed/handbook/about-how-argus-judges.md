---
id: about-how-argus-judges
title: How ARGUS judges a reading
category: about
order: 1
signalIds: []
keywords: [verdict, verdicts, layers, three layers, personal, space, earth, quality, nominal, expected, watch, act, no data, how it works, caught only by personal baseline]
sourceIds: [SRC_STD3001_CO2, SRC_EARTH_BP_ACC_AHA, SRC_DEMO_BASELINE_ENGINE, SRC_DEMO_RULE_BANDS, SRC_DEMO_QUALITY_SCORES]
summary: Every reading is judged three ways (Personal, Space, Earth) plus quality, and combined into one of five verdicts.
---

## Three layers and quality

Every health reading gets three separate judgements and one combined verdict:

- **Personal:** is this unusual for you? It compares the reading with your own baseline [SRC_DEMO_BASELINE_ENGINE].
- **Space:** is this expected or concerning in this mission environment? It uses space-adapted rules from NASA standards and evidence, such as the NASA-STD-3001 cabin CO₂ limit [SRC_STD3001_CO2].
- **Earth:** would a clinic on Earth flag it? It uses clinical reference ranges, such as the ACC/AHA blood-pressure categories [SRC_EARTH_BP_ACC_AHA].
- **Quality:** can the reading be trusted? It looks at the source, the age and the signal quality of the reading [SRC_DEMO_QUALITY_SCORES].

Band edges marked Demo parameter are our own choices for this prototype, not clinical or NASA limits [SRC_DEMO_RULE_BANDS]. The CMO is the Crew Medical Officer, the crew member responsible for the whole crew's health.

## The five verdicts

- **Nominal:** "Within your usual range."
- **Expected in space:** "A known change in space. Keep doing your countermeasures."
- **Watch:** "Unusual. Re-measure and keep an eye on it."
- **Act:** "Needs action now. Follow the next step and tell the CMO."
- **No data:** "No recent reading. Measure to update."

## How the layers combine

- A layer with no verdict (its rule does not apply, or there is no baseline yet) is left out. If no layer is left, the verdict is No data.
- **Known adaptation:** when Earth says Watch, space says Expected in space and your personal baseline is fine, the verdict is Expected in space: "Earth would flag this, but it is a known adaptation in space."
- When Earth says Act in the same situation, the verdict is Watch: "Earth would rate this as urgent, but it is a known adaptation in space, so it is softened by one level to Watch."
- Otherwise the most severe layer sets the verdict, and the screen shows which layer drove it.
- **Quality gate:** a poor-quality reading gives at most Watch, with the action "Reading quality is poor. Re-measure." A fair reading never gives Act from the personal layer alone: "Reading quality is only fair, so a personal-only Act is shown as Watch until it is confirmed."
- When a day has several readings, the day counts with the quality of its best reading, so a weaker extra reading never weakens a good day.
- A reading older than 1.5 times its usual measuring interval asks for a re-measure; older than 3 times, the signal shows No data [SRC_DEMO_QUALITY_SCORES].
- The action shown is the signal's own template when it has one. Otherwise: Expected in space, "Known change in space. Keep doing your countermeasures."; Watch, "Re-measure. If it is still outside your usual range, tell the CMO."; Act, "Tell the CMO now and send a report to the flight surgeon."; No data, "Measure to update."

## Caught only by personal baseline

When your personal layer says Watch or Act while the space and Earth layers say Expected in space or less, ARGUS marks the verdict "Caught only by personal baseline": "Only your personal baseline caught this; the Earth and space rules do not flag it." These are the changes that fixed thresholds miss, for example a resting heart rate that rises well above your usual but stays inside the Earth range.

## Sources

- [SRC_STD3001_CO2]
- [SRC_EARTH_BP_ACC_AHA]
- [SRC_DEMO_BASELINE_ENGINE]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_QUALITY_SCORES]
