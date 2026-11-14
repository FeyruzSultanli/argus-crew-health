// The "usual" band for the camera result: today's personal band from usePersonalSeries (doc 08 §6).

/** Today's personal band (or the latest one before today) from the baseline engine's series. */
export function usualBand(
  series: ReadonlyArray<{ missionDay: number; lo: number; hi: number }> | undefined,
  missionDay: number,
): { lo: number; hi: number } | undefined {
  if (!series) return undefined;
  for (let i = series.length - 1; i >= 0; i--) {
    const p = series[i];
    if (p && p.missionDay <= missionDay && Number.isFinite(p.lo) && Number.isFinite(p.hi))
      return { lo: p.lo, hi: p.hi };
  }
  return undefined;
}
