// Build-time feature flags. Keep this list short; runtime demo switches live in useMissionStore.demo.
export const featureFlags = {
  /** Hidden component gallery at /dev/ui (not in the nav). Kept in production builds for the judges' review. */
  devUiRoute: true,
  /** Lab "Face fluid-shift scan" (experimental, trend only). Off → the tile shows "Coming next". */
  faceFluidScan: true,
} as const;

export type FeatureFlags = typeof featureFlags;
