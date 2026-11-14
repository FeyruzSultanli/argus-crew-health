// Trends feature (doc 11 §5.3). The route component is the default export of TrendsPage.tsx.
export { buildTrendModel } from './trendData';
export type { TrendModel, TrendTrack, TrendPoint } from './trendData';
export { buildCsv, parseCsv } from './csv';
export { eventsFor } from './events';
