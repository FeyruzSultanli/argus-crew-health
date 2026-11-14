import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';

import { BODY_REGIONS } from '../features/body/regions';
import {
  HOME_VIEW,
  NODE_REGION,
  REGION_ANCHORS,
  REGION_DISTANCE,
  REGION_NODES,
  ZONE_VIEWS,
} from './anatomyMap';
import { MAX_DISTANCE, MIN_DISTANCE, viewFor } from './cameraViews';
import { createOrganMaterials, createSkinMaterial, organTarget, readPalette } from './materials';
import { MaterialTweener, TWEEN_MS } from './tweener';

describe('anatomy map', () => {
  it('maps every body region and every organ node back to its region', () => {
    expect(Object.keys(REGION_NODES).sort()).toEqual(BODY_REGIONS.map((r) => r.id).sort());
    expect(Object.keys(REGION_ANCHORS).sort()).toEqual(BODY_REGIONS.map((r) => r.id).sort());
    expect(NODE_REGION.heart).toBe('heart');
    expect(NODE_REGION.kidney_l).toBe('kidneys');
    expect(NODE_REGION.femur_r).toBe('skeleton');
  });
});

describe('camera views', () => {
  const current = { target: new Vector3(0, 1, 0), distance: 2 };
  it('presets and region fly-to', () => {
    expect(viewFor({ kind: 'home', seq: 1 }, REGION_ANCHORS, current)).toBe(HOME_VIEW);
    expect(viewFor({ kind: 'zone', zone: 'chest', seq: 1 }, REGION_ANCHORS, current)).toBe(ZONE_VIEWS.chest);
    expect(viewFor({ kind: 'region', region: 'heart', seq: 1 }, REGION_ANCHORS, current)).toEqual({
      target: REGION_ANCHORS.heart,
      distance: REGION_DISTANCE,
    });
  });
  it('zoom keeps the target and clamps the distance', () => {
    expect(viewFor({ kind: 'zoom', dir: 1, seq: 1 }, REGION_ANCHORS, current).distance).toBeCloseTo(1.5);
    expect(
      viewFor({ kind: 'zoom', dir: 1, seq: 1 }, REGION_ANCHORS, { ...current, distance: MIN_DISTANCE })
        .distance,
    ).toBe(MIN_DISTANCE);
    expect(
      viewFor({ kind: 'zoom', dir: -1, seq: 1 }, REGION_ANCHORS, { ...current, distance: MAX_DISTANCE })
        .distance,
    ).toBe(MAX_DISTANCE);
  });
});

describe('organ colours', () => {
  const p = readPalette();
  it('ACT pulses in the act hue, NOMINAL stays neutral, filtered organs dim and stop pulsing', () => {
    expect(organTarget('ACT', p, false)).toMatchObject({ pulse: true, opacity: 1 });
    expect(organTarget('ACT', p, false).color.equals(p.act)).toBe(true);
    expect(organTarget('NOMINAL', p, false).color.equals(p.neutral)).toBe(true);
    expect(organTarget('NOMINAL', p, false).emissiveIntensity).toBe(0);
    expect(organTarget('ACT', p, true)).toMatchObject({ pulse: false, opacity: 0.14, emissiveIntensity: 0 });
  });

  it('tweens over 300 ms (instantly under reduced motion)', () => {
    const mats = createOrganMaterials();
    const skin = createSkinMaterial();
    const heart = mats.get('heart');
    const tw = new MaterialTweener(mats, skin);
    const targets = new Map([['heart' as const, organTarget('WATCH', p, false)]]);
    const skinTarget = { base: p.neutral, rim: p.rim, rimStrength: 0.5 };
    tw.retarget(targets, skinTarget, false, 1000);
    expect(tw.step(1000 + TWEEN_MS / 2)).toBe(true);
    expect(heart?.color.getHexString()).not.toBe(p.watch.getHexString());
    expect(tw.step(1000 + TWEEN_MS)).toBe(false);
    expect(heart?.color.getHexString()).toBe(p.watch.getHexString());

    tw.retarget(new Map([['heart' as const, organTarget('NOMINAL', p, false)]]), skinTarget, true, 5000);
    tw.step(5000);
    expect(heart?.color.getHexString()).toBe(p.neutral.getHexString());
  });
});
