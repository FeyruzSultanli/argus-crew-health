import { createContext, useContext } from 'react';

export interface SourceDrawerApi {
  /** Open the right sheet listing these sources. `title` names what they back, e.g. "Resting heart rate". */
  open: (sourceIds: readonly string[], title?: string) => void;
}

export const SourceDrawerContext = createContext<SourceDrawerApi | null>(null);

/** The app-wide source drawer, or null outside <SourceDrawerProvider> (badges then render without a drawer). */
export function useSourceDrawer(): SourceDrawerApi | null {
  return useContext(SourceDrawerContext);
}
