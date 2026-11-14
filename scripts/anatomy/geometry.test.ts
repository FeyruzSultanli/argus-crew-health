import { describe, expect, it } from 'vitest';

import { bounds, compact, mergeMeshes, simplifyTo, translate, vertexNormals, weld } from './geometry';
import { ORGAN_RULES } from './organs';

/** A unit quad split into an n × n grid (2·n² triangles) in the xy plane. */
function grid(n: number): { positions: Float32Array; indices: Uint32Array } {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let y = 0; y <= n; y += 1) for (let x = 0; x <= n; x += 1) pos.push(x / n, y / n, 0);
  for (let y = 0; y < n; y += 1)
    for (let x = 0; x < n; x += 1) {
      const a = y * (n + 1) + x;
      idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
    }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

describe('anatomy geometry helpers', () => {
  it('merges with index offsets and welds shared seams', () => {
    const a = grid(1);
    const b = grid(1);
    const merged = mergeMeshes([a, b]);
    expect(merged.positions.length).toBe(24);
    expect(merged.indices[6]).toBe(4);
    const welded = weld(merged);
    expect(welded.positions.length / 3).toBe(4); // identical quads collapse onto 4 vertices
    expect(welded.indices.length).toBe(12);
  });

  it('simplifies to the triangle budget and compacts vertices', async () => {
    const g = grid(20); // 800 triangles
    const s = await simplifyTo(g, 100);
    expect(s.indices.length / 3).toBeLessThanOrEqual(105);
    expect(Math.max(...s.indices)).toBeLessThan(s.positions.length / 3);
    expect(compact(g).positions.length).toBe(g.positions.length);
  });

  it('normals of a flat xy grid point along +z; bounds and translate', () => {
    const g = grid(2);
    const n = vertexNormals(g);
    expect(n[2]).toBeCloseTo(1);
    translate(g.positions, 0, 1, 0);
    expect(bounds(g.positions)).toEqual({ min: [0, 1, 0], max: [1, 2, 0] });
  });

  it('organ budgets stay within 150k triangles per body and cover the stable ids', () => {
    expect(ORGAN_RULES.reduce((n, r) => n + r.budget, 0)).toBeLessThanOrEqual(150_000);
    expect(ORGAN_RULES.map((r) => r.id)).toEqual([
      'skin',
      'brain',
      'eye_l',
      'eye_r',
      'heart',
      'lung_l',
      'lung_r',
      'aorta',
      'liver',
      'pancreas',
      'kidney_l',
      'kidney_r',
      'bladder',
      'spine',
      'pelvis',
      'femur_l',
      'femur_r',
    ]);
  });
});
