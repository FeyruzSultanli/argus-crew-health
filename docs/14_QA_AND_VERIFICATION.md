# 14 — QA and verification

## 1. Test pyramid

| Level | Tooling | Scope | Gate |
|-------|---------|-------|------|
| Unit | Vitest | `src/domain/**`, `src/measurement/**` pure parts, `scripts/check-sources.ts` | every PR; coverage ≥ 85 % domain |
| Component | Testing Library | ui components, forms (validation), SignalCard order | every PR |
| E2E | Playwright | demo script, offline, a11y (axe), keyboard flows | before the feature freeze; final run on the production URL |
| Manual | by hand | camera flows on 2+ laptops, 3D performance, copy review, video rehearsal | before the feature freeze |

## 2. Domain test matrix (minimum)

- Every rule band edge (value exactly at threshold and ±1 unit) for every P0 signal.
- `combine()` branches: NO_DATA all; single layer; adaptation downgrade; earth ACT + space EXPECTED → WATCH;
  quality poor cap; quality fair + personal-only ACT → WATCH; caughtOnlyByPersonal true/false cases.
- Baseline TV-1…TV-10 (doc 08 §8).
- S-scale thresholds and debounce; dose ledger sums; shelter policy table.
- POS on synthetic signals; PVT scoring with fake clock.
- FHIR bundle shape; LOINC code presence for mapped signals.
- Generator determinism and scenario placement.

## 3. Demo-critical e2e (must be green on the deployed URL)

1. Fresh load → role picker → CMO → Bridge shows Mars transit, day 143, delay 11 min, SIMULATED badge.
2. Crew at a glance: K. Osei = ACT, marker "Caught only by personal baseline".
3. Body → K. Osei → heart region glows → signal card shows action first, layers P=ACT S=NOMINAL E=NOMINAL.
4. Lens = Earth → heart region neutral; lens = Personal → glows.
5. Environment → replay SPE → S2+ and shelter advisory; dose ledger moves; "Modeled — illustrative" visible.
6. Lab → PVT (fake input in test mode) → result saved → Bridge plan item ticked.
7. Earth link → send packet → countdown → delivered (surgeon tab receives in multi-page test).
8. Settings → export FHIR → file downloads and parses.
9. Offline: reload with network disabled → Bridge/Body/Lab/Environment(SNAPSHOT) render.

## 4. Honesty checklist (manual, before submission)

- [ ] Every screen with simulated crew data shows the SIMULATED DATA badge.
- [ ] Every number has a source badge; every `demo` value shows "Demo parameter" on its badge.
- [ ] No diagnosis wording; no drug doses; protocols tagged source/demo wording.
- [ ] Camera: privacy line visible; no frames in network log; no frames in IndexedDB.
- [ ] Experimental features labeled (face index, respiration).
- [ ] Replay is badged REPLAY (and "synthetic" when it is not a recorded event); nothing in the app, video or slides
      calls it real or live. The Mars-transit delay is shown as "modeled".
- [ ] Limits page lists real vs simulated vs modeled vs experimental; rPPG validation numbers shown honestly.
- [ ] No NASA logos/insignia.
- [ ] CREDITS.md lists HRA/BodyParts3D (CC BY 4.0), MediaPipe (Apache-2.0), fonts (OFL), icons (ISC).

## 5. Fact-check procedure for `partial` sources

For each: open the link (or find the paper), locate the exact sentence/number, then either (a) set status
`verified` and paste the paraphrase in `says`, (b) correct the number everywhere it is used, or (c) downgrade to
`demo` and make sure the UI labels it. Never upgrade without opening the source.

## 6. Device matrix for manual QA

| Device | Browser | Checks |
|--------|---------|--------|
| Laptop (integrated GPU) | Chrome | full demo, 3D fps, rPPG |
| Laptop | Firefox | shell, charts, PVT timing |
| Tablet landscape (or DevTools 1024×768) | Chrome | layout, touch targets, glove mode |
| MacBook | Safari 17+ | best-effort: shell, charts, camera permission flow |
