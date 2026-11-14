// "How to measure" summaries — verbatim from the table in docs/09_MEASUREMENT_LAB.md §5 (general clinical practice
// wording, tagged "demo wording" in the UI; procedure settings under SRC_DEMO_QUALITY_SCORES). Do not add advice here.
export const HOWTO = {
  bloodPressure:
    'Rest 5 min seated (restrained in microgravity), arm supported at heart level, correct cuff size, no talking; take 2 readings 1 min apart, enter the average',
  pulseOximetry: 'Warm finger, no nail polish, keep still 30 s, read when number is stable',
  temperature: 'Same device and site each time; note if after exercise',
  glucose: 'Wash/dry hands, lancet on side of fingertip, first drop on strip; note fasting or not',
  bodyMass: 'Use the mass-measurement device per its procedure; same time of day',
  sleep: 'From wearable (auto) or self-report hours + quality 1–5',
  mood: '5 faces scale + optional note ("one line about today")',
  symptoms: 'Checklist (doc 07 §4.17)',
} as const;

export type HowToId = keyof typeof HOWTO;
