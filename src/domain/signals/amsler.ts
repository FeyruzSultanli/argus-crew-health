// doc 07 §4.10 Amsler grid — `amsler` (per eye).
// Observation: value = number of grid cells marked distorted/missing; context.eye = 'left' | 'right';
// components = { newCells, newCentralCells } — cells new vs the previous map of the same eye, and how many of
// those lie within 2 cells of the centre (doc 09 §3.2 diff). If `newCells` is missing it is estimated as
// max(0, value − previous count of the same eye); a missing `newCentralCells` counts as 0.
// Both rule layers judge every eye tested on the reading's day (latest map per eye) and report the worse eye.
import { chronological } from '../rules/history';
import { layerResult, notApplicable, worstOf } from '../rules/layer';
import type { LayerId, LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { NASA_RISKS } from './common';

type Eye = 'left' | 'right' | 'unspecified';

interface EyeReading {
  eye: Eye;
  count: number;
  newCells: number;
  newCentral: number;
}

const eyeOf = (o: Observation): Eye => o.context?.eye ?? 'unspecified';
const eyeLabel = (e: Eye): string => (e === 'left' ? 'Left eye' : e === 'right' ? 'Right eye' : 'Eye');

/** Latest map per eye on the reading's day, with the diff vs the previous map of that eye. */
export function amslerReadings(o: Observation, ctx: RuleCtx): EyeReading[] {
  const all = chronological(ctx.history.length > 0 ? ctx.history : [o]);
  const byEye = new Map<Eye, Observation>();
  for (const r of all)
    if (r.missionDay === o.missionDay && typeof r.value === 'number') byEye.set(eyeOf(r), r);
  const out: EyeReading[] = [];
  for (const [eye, r] of byEye) {
    const count = r.value as number;
    const prev = all
      .filter((p) => eyeOf(p) === eye && p.missionDay < r.missionDay && typeof p.value === 'number')
      .at(-1);
    const estimated = prev === undefined ? 0 : Math.max(0, count - (prev.value as number));
    out.push({
      eye,
      count,
      newCells: r.components?.newCells ?? estimated,
      newCentral: r.components?.newCentralCells ?? 0,
    });
  }
  return out;
}

function judgeEye(e: EyeReading, layer: LayerId): LayerResult {
  const id = `amsler.${layer}`;
  const name = eyeLabel(e.eye);
  const numbers = { [`${e.eye}Count`]: e.count, [`${e.eye}NewCells`]: e.newCells };
  const sources = layer === 'earth' ? ['SRC_VISION_ISS'] : ['SRC_VISION_ISS', 'SRC_SANS_CAMBRIDGE'];
  if (e.newCentral >= 1) {
    return layerResult(
      layer,
      'ACT',
      `${name}: ${e.newCentral} new marked cell(s) near the centre.`,
      sources,
      `${id}.central`,
      numbers,
    );
  }
  if (layer === 'earth' && e.count >= 1) {
    return layerResult(
      layer,
      'WATCH',
      `${name}: ${e.count} marked cell(s); on Earth any marked cell means see an eye professional.`,
      sources,
      `${id}.any`,
      numbers,
    );
  }
  if (layer === 'space' && e.newCells >= 1) {
    return layerResult(
      layer,
      'WATCH',
      `${name}: ${e.newCells} new marked cell(s) vs the previous map.`,
      sources,
      `${id}.new`,
      numbers,
    );
  }
  const reason =
    layer === 'earth' ? `${name}: no marked cells.` : `${name}: no new marked cells vs the previous map.`;
  return layerResult(layer, 'NOMINAL', reason, sources, `${id}.none`, numbers);
}

function judge(o: Observation, ctx: RuleCtx, layer: LayerId): LayerResult {
  const eyes = amslerReadings(o, ctx);
  if (eyes.length === 0) return notApplicable(layer, 'This reading has no cell count.', `amsler.${layer}.na`);
  return worstOf(eyes.map((e) => judgeEye(e, layer)));
}

export const amsler: SignalDef = {
  id: 'amsler',
  label: 'Amsler grid',
  shortWhat:
    'A grid you look at with one eye at a time, marking any lines that look wavy, blurred or missing.',
  whyInSpace:
    'Eye changes (SANS) are a NASA human-research risk for long missions. The ISS in-flight vision exam ' +
    'includes an Amsler grid on a laptop. Screening only.',
  howToMeasure: [
    'Calibrate the screen once per device.',
    'Sit 30–35 cm from the screen and wear your usual near glasses.',
    'Cover one eye and look at the centre dot.',
    'Mark cells that look wavy, blurred or missing.',
    'Repeat with the other eye.',
  ],
  hazard: 'gravity',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['eyes'],
  system: 'neuro-eye',
  // Research cadence: mission days 10, 30, 60, 90, 120, then every 30 [SRC_OCULAR_CADENCE]; the plan module
  // schedules the exact days, staleness uses the steady 30-day interval.
  cadenceDays: 30,
  concerningDirection: 'up',
  personal: { enabled: false, params: [] },
  earth: (o, ctx) => judge(o, ctx, 'earth'),
  space: (o, ctx) => judge(o, ctx, 'space'),
  // The vision-change protocol is attached by assessSignal only when the space layer flags new cells
  // (doc 07 §5 trigger "Amsler new cells"); an Earth-only WATCH for an old, unchanged cell gets the text alone.
  actions: {
    WATCH: { text: 'Schedule imaging/remote eye exam.', kind: 'remeasure' },
  },
  sourceIds: ['SRC_VISION_ISS', 'SRC_SANS_CAMBRIDGE', 'SRC_OCULAR_CADENCE', NASA_RISKS],
};
