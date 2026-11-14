// Motion's animation feature bundle, loaded after first paint by <LazyMotion features={…}>
// in src/ui/shell/RootLayout.tsx so it stays out of the initial chunk. `m` components render immediately and start
// animating once this resolves (a few ms after boot; motion is decorative, never information). See doc 05 §10.
export { domAnimation } from 'motion/react';
