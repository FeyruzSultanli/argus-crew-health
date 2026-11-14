// Geometry helpers for scripts/build-anatomy.ts: merge, weld, simplify (meshoptimizer), normals. Pure functions.
import { MeshoptSimplifier } from 'meshoptimizer';

export interface RawMesh {
  positions: Float32Array; // xyz, world space
  indices: Uint32Array;
}

/** Concatenate meshes (indices offset). */
export function mergeMeshes(parts: readonly RawMesh[]): RawMesh {
  const vCount = parts.reduce((n, p) => n + p.positions.length, 0);
  const iCount = parts.reduce((n, p) => n + p.indices.length, 0);
  const positions = new Float32Array(vCount);
  const indices = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const p of parts) {
    positions.set(p.positions, vo);
    const base = vo / 3;
    for (let i = 0; i < p.indices.length; i += 1) indices[io + i] = (p.indices[i] ?? 0) + base;
    vo += p.positions.length;
    io += p.indices.length;
  }
  return { positions, indices };
}

/** Merge vertices closer than `eps` metres (seams between sub-meshes), dropping degenerate triangles. */
export function weld(mesh: RawMesh, eps = 1e-5): RawMesh {
  const map = new Map<string, number>();
  const remap = new Uint32Array(mesh.positions.length / 3);
  const out: number[] = [];
  for (let v = 0; v < remap.length; v += 1) {
    const x = mesh.positions[v * 3] ?? 0;
    const y = mesh.positions[v * 3 + 1] ?? 0;
    const z = mesh.positions[v * 3 + 2] ?? 0;
    const key = `${Math.round(x / eps)},${Math.round(y / eps)},${Math.round(z / eps)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = out.length / 3;
      map.set(key, idx);
      out.push(x, y, z);
    }
    remap[v] = idx;
  }
  const tris: number[] = [];
  for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
    const a = remap[mesh.indices[i] ?? 0] ?? 0;
    const b = remap[mesh.indices[i + 1] ?? 0] ?? 0;
    const c = remap[mesh.indices[i + 2] ?? 0] ?? 0;
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  return { positions: new Float32Array(out), indices: new Uint32Array(tris) };
}

/** Keep only referenced vertices, renumbered. */
export function compact(mesh: RawMesh): RawMesh {
  const remap = new Int32Array(mesh.positions.length / 3).fill(-1);
  const pos: number[] = [];
  const idx = new Uint32Array(mesh.indices.length);
  for (let i = 0; i < mesh.indices.length; i += 1) {
    const v = mesh.indices[i] ?? 0;
    let r = remap[v] ?? -1;
    if (r < 0) {
      r = pos.length / 3;
      remap[v] = r;
      pos.push(mesh.positions[v * 3] ?? 0, mesh.positions[v * 3 + 1] ?? 0, mesh.positions[v * 3 + 2] ?? 0);
    }
    idx[i] = r;
  }
  return { positions: new Float32Array(pos), indices: idx };
}

/** Simplify to at most `targetTriangles` (meshoptimizer; falls back to sloppy simplification if needed). */
export async function simplifyTo(mesh: RawMesh, targetTriangles: number): Promise<RawMesh> {
  await MeshoptSimplifier.ready;
  const targetIndex = targetTriangles * 3;
  if (mesh.indices.length <= targetIndex) return compact(mesh);
  let [idx] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, targetIndex, 0.02, ['Prune']);
  if (idx.length > targetIndex * 1.05) {
    [idx] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, targetIndex, 0.08, ['Prune']);
  }
  if (idx.length > targetIndex * 1.05) {
    [idx] = MeshoptSimplifier.simplifySloppy(mesh.indices, mesh.positions, 3, null, targetIndex, 0.1);
  }
  return compact({ positions: mesh.positions, indices: idx });
}

/** Smooth vertex normals (area-weighted face normals). */
export function vertexNormals(mesh: RawMesh): Float32Array {
  const n = new Float32Array(mesh.positions.length);
  const p = mesh.positions;
  for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
    const a = (mesh.indices[i] ?? 0) * 3;
    const b = (mesh.indices[i + 1] ?? 0) * 3;
    const c = (mesh.indices[i + 2] ?? 0) * 3;
    const ux = (p[b] ?? 0) - (p[a] ?? 0);
    const uy = (p[b + 1] ?? 0) - (p[a + 1] ?? 0);
    const uz = (p[b + 2] ?? 0) - (p[a + 2] ?? 0);
    const vx = (p[c] ?? 0) - (p[a] ?? 0);
    const vy = (p[c + 1] ?? 0) - (p[a + 1] ?? 0);
    const vz = (p[c + 2] ?? 0) - (p[a + 2] ?? 0);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      n[k] = (n[k] ?? 0) + nx;
      n[k + 1] = (n[k + 1] ?? 0) + ny;
      n[k + 2] = (n[k + 2] ?? 0) + nz;
    }
  }
  for (let v = 0; v < n.length; v += 3) {
    const len = Math.hypot(n[v] ?? 0, n[v + 1] ?? 0, n[v + 2] ?? 0) || 1;
    n[v] = (n[v] ?? 0) / len;
    n[v + 1] = (n[v + 1] ?? 0) / len;
    n[v + 2] = (n[v + 2] ?? 0) / len;
  }
  return n;
}

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export function bounds(positions: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      const v = positions[i + k] ?? 0;
      if (v < (min[k] ?? 0)) min[k] = v;
      if (v > (max[k] ?? 0)) max[k] = v;
    }
  }
  return { min, max };
}

/** Translate in place. */
export function translate(positions: Float32Array, dx: number, dy: number, dz: number): void {
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] ?? 0) + dx;
    positions[i + 1] = (positions[i + 1] ?? 0) + dy;
    positions[i + 2] = (positions[i + 2] ?? 0) + dz;
  }
}
