// Personal baseline engine (doc 08).
// `median` lives in rules/history (re-exported by ./robust for local use) and is not re-exported here, so
// `export * from './baseline'` in src/domain/index.ts stays unambiguous.
export * from './constants';
export { mad, robustSigma, robustStats } from './robust';
export type { RobustStats } from './robust';
export * from './aggregate';
export * from './reference';
export * from './cusum';
export * from './stateMachine';
export * from './engine';
export * from './explain';
export * from './personal';
export { clearPersonalCache, personalCacheStats, fingerprint } from './cache';
