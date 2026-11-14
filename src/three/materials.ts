// Materials for the 3D body: one standard material per organ node, a Fresnel shell for the skin (doc 11 §6),
// and the verdict → colour targets that the animator tweens towards. No React here.
import { Color, FrontSide, MeshStandardMaterial, NormalBlending, ShaderMaterial } from 'three';

import type { Verdict } from '../domain/types';
import type { OrganNodeId } from './anatomyMap';
import { ORGAN_NODE_IDS } from './anatomyMap';

/** Status hues come from the design tokens; organ neutral is a fixed grey-blue (doc 11 §6). */
export interface ScenePalette {
  ok: Color;
  info: Color;
  watch: Color;
  act: Color;
  muted: Color;
  neutral: Color;
  rim: Color;
}

function cssColor(style: CSSStyleDeclaration | null, name: string, fallback: string): Color {
  const v = style?.getPropertyValue(name).trim();
  try {
    return new Color(v && v.length > 0 ? v : fallback);
  } catch {
    return new Color(fallback);
  }
}

/** Read the status tokens of the active theme (call again when the theme changes). */
export function readPalette(): ScenePalette {
  const style = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement);
  return {
    ok: cssColor(style, '--ok', '#3DD68C'),
    info: cssColor(style, '--info', '#5AB8FF'),
    watch: cssColor(style, '--watch', '#F5B83D'),
    act: cssColor(style, '--act', '#FF5A5F'),
    muted: cssColor(style, '--muted', '#5B6672'),
    neutral: new Color('#7b8ea3'),
    rim: new Color('#9fb4c8'),
  };
}

export interface OrganTarget {
  color: Color;
  emissive: Color;
  emissiveIntensity: number;
  opacity: number;
  pulse: boolean;
}

/** Target look of an organ for a verdict; `dim` = outside the active system filter. */
export function organTarget(v: Verdict, p: ScenePalette, dim: boolean): OrganTarget {
  const black = new Color(0, 0, 0);
  let t: OrganTarget;
  switch (v) {
    case 'ACT':
      t = { color: p.act.clone(), emissive: p.act.clone(), emissiveIntensity: 0.55, opacity: 1, pulse: true };
      break;
    case 'WATCH':
      t = {
        color: p.watch.clone(),
        emissive: p.watch.clone(),
        emissiveIntensity: 0.4,
        opacity: 1,
        pulse: false,
      };
      break;
    case 'EXPECTED':
      t = {
        color: p.neutral.clone().lerp(p.info, 0.45),
        emissive: p.info.clone(),
        emissiveIntensity: 0.12,
        opacity: 1,
        pulse: false,
      };
      break;
    case 'NOMINAL':
      t = { color: p.neutral.clone(), emissive: black, emissiveIntensity: 0, opacity: 1, pulse: false };
      break;
    case 'NO_DATA':
      t = {
        color: p.neutral.clone().lerp(p.muted, 0.6),
        emissive: black,
        emissiveIntensity: 0,
        opacity: 1,
        pulse: false,
      };
      break;
  }
  if (dim) {
    t.opacity = 0.14;
    t.pulse = false;
    t.emissiveIntensity = 0;
  }
  return t;
}

export function createOrganMaterials(): Map<OrganNodeId, MeshStandardMaterial> {
  const m = new Map<OrganNodeId, MeshStandardMaterial>();
  for (const id of ORGAN_NODE_IDS) {
    if (id === 'skin') continue;
    m.set(
      id,
      new MeshStandardMaterial({
        name: `organ-${id}`,
        color: new Color('#7b8ea3'),
        roughness: 0.55,
        metalness: 0.05,
        transparent: true,
        opacity: 1,
      }),
    );
  }
  return m;
}

const SKIN_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const SKIN_FRAGMENT = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uRimStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
    vec3 col = mix(uBase, uRim, f);
    gl_FragColor = vec4(col, clamp(uOpacity + f * uRimStrength, 0.0, 1.0));
  }
`;

/** Translucent Fresnel shell (opacity ≈ 0.18 at the centre, brighter at the rim). */
export function createSkinMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'skin-fresnel',
    uniforms: {
      uBase: { value: new Color('#7b8ea3') },
      uRim: { value: new Color('#9fb4c8') },
      uOpacity: { value: 0.18 },
      uRimStrength: { value: 0.5 },
    },
    vertexShader: SKIN_VERTEX,
    fragmentShader: SKIN_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    blending: NormalBlending,
  });
}
