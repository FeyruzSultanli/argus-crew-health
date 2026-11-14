// Imperative colour tween for the 3D body materials (kept outside React: three.js objects are mutated per frame).
import type { Color, MeshStandardMaterial, ShaderMaterial } from 'three';

import type { OrganNodeId } from './anatomyMap';
import type { OrganTarget } from './materials';

/** Colour tween (doc 11 §6: 300 ms when the mission day or lens changes) and ACT pulse period (1.2 s). */
export const TWEEN_MS = 300;
export const PULSE_MS = 1200;

export interface SkinTarget {
  base: Color;
  rim: Color;
  rimStrength: number;
}

interface Track {
  from: { color: Color; emissive: Color; intensity: number; opacity: number };
  to: OrganTarget;
  start: number;
}

const ease = (t: number) => 1 - (1 - t) ** 3;

export class MaterialTweener {
  private tracks = new Map<OrganNodeId, Track>();
  private skinTrack: { from: SkinTarget; to: SkinTarget; start: number } | null = null;
  private reduced = false;

  private readonly materials: Map<OrganNodeId, MeshStandardMaterial>;
  private readonly skin: ShaderMaterial;

  constructor(materials: Map<OrganNodeId, MeshStandardMaterial>, skin: ShaderMaterial) {
    this.materials = materials;
    this.skin = skin;
  }

  /** New targets: every material tweens from its current look (instantly under reduced motion). */
  retarget(
    targets: Map<OrganNodeId, OrganTarget>,
    skinTarget: SkinTarget,
    reduced: boolean,
    now: number,
  ): void {
    this.reduced = reduced;
    const start = reduced ? now - TWEEN_MS : now;
    for (const [id, to] of targets) {
      const m = this.materials.get(id);
      if (!m) continue;
      this.tracks.set(id, {
        from: {
          color: m.color.clone(),
          emissive: m.emissive.clone(),
          intensity: m.emissiveIntensity,
          opacity: m.opacity,
        },
        to,
        start,
      });
    }
    const u = this.skin.uniforms;
    this.skinTrack = {
      from: {
        base: (u.uBase?.value as Color).clone(),
        rim: (u.uRim?.value as Color).clone(),
        rimStrength: u.uRimStrength?.value as number,
      },
      to: skinTarget,
      start,
    };
  }

  /** Advance to `now`; returns true while anything still moves (tween or ACT pulse). */
  step(now: number): boolean {
    let moving = false;
    for (const [id, tr] of this.tracks) {
      const m = this.materials.get(id);
      if (!m) continue;
      const p = Math.min(1, (now - tr.start) / TWEEN_MS);
      const k = ease(p);
      if (p < 1) moving = true;
      m.color.copy(tr.from.color).lerp(tr.to.color, k);
      m.emissive.copy(tr.from.emissive).lerp(tr.to.emissive, k);
      m.opacity = tr.from.opacity + (tr.to.opacity - tr.from.opacity) * k;
      m.depthWrite = m.opacity > 0.99;
      let intensity = tr.from.intensity + (tr.to.emissiveIntensity - tr.from.intensity) * k;
      if (tr.to.pulse && !this.reduced) {
        intensity *= 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((2 * Math.PI * now) / PULSE_MS));
        moving = true;
      }
      m.emissiveIntensity = intensity;
    }
    const st = this.skinTrack;
    if (st) {
      const p = Math.min(1, (now - st.start) / TWEEN_MS);
      const k = ease(p);
      if (p < 1) moving = true;
      const u = this.skin.uniforms;
      (u.uBase?.value as Color).copy(st.from.base).lerp(st.to.base, k);
      (u.uRim?.value as Color).copy(st.from.rim).lerp(st.to.rim, k);
      if (u.uRimStrength)
        u.uRimStrength.value = st.from.rimStrength + (st.to.rimStrength - st.from.rimStrength) * k;
    }
    return moving;
  }
}
