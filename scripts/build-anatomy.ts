// Builds the 3D reference bodies for the Body screen (doc 12 §3, doc 11 §6).
//
//   npm run build:anatomy            (both bodies; `npm run build:anatomy -- male` for one)
//
// Input: HRA 3D Reference Organs "united" bodies (CC BY 4.0), downloaded into assets-src/hra/ (git-ignored):
//   male-united.glb   ← https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.10/assets/3d-vh-m-united.glb
//   female-united.glb ← https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb
// Steps per body: take the organs of doc 07 §6 (scripts/anatomy/organs.ts), merge each organ's meshes in world space,
// weld, simplify with meshoptimizer to the organ's budget (≤ 150k triangles per body), normalise (metres, feet at
// y = 0, centred on x/z, facing +z), write one node + one mesh + one material per stable id, then dedup, prune and
// meshopt-compress (EXT_meshopt_compression + KHR_mesh_quantization). Missing organs are logged and left out (the app
// falls back to a hotspot without a mesh).
// Output: public/anatomy/male.glb, public/anatomy/female.glb, public/anatomy/manifest.json.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Document, NodeIO } from '@gltf-transform/core';
import type { Node as GltfNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

import { bounds, mergeMeshes, simplifyTo, translate, vertexNormals, weld } from './anatomy/geometry';
import type { RawMesh } from './anatomy/geometry';
import { ATTRIBUTION, ORGAN_RULES, SOURCES } from './anatomy/organs';
import type { OrganRule, Sex } from './anatomy/organs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = join(root, 'public', 'anatomy');
const MAX_TRIANGLES = 150_000;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

type Mat4 = readonly number[];

function applyMat4(p: ArrayLike<number>, m: Mat4): Float32Array {
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i] ?? 0;
    const y = p[i + 1] ?? 0;
    const z = p[i + 2] ?? 0;
    out[i] = (m[0] ?? 1) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0);
    out[i + 1] = (m[1] ?? 0) * x + (m[5] ?? 1) * y + (m[9] ?? 0) * z + (m[13] ?? 0);
    out[i + 2] = (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 1) * z + (m[14] ?? 0);
  }
  return out;
}

/** Every mesh-bearing node below `start` (inclusive), with the names on the path from `start`. */
function collect(start: GltfNode): Array<{ node: GltfNode; path: string }> {
  const out: Array<{ node: GltfNode; path: string }> = [];
  const walk = (n: GltfNode, path: string) => {
    const p = `${path}/${n.getName()}`;
    if (n.getMesh()) out.push({ node: n, path: p });
    for (const c of n.listChildren()) walk(c, p);
  };
  walk(start, '');
  return out;
}

function nodeMeshes(node: GltfNode): RawMesh[] {
  const mesh = node.getMesh();
  if (!mesh) return [];
  const world = node.getWorldMatrix();
  const out: RawMesh[] = [];
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMode() !== 4) continue; // TRIANGLES only
    const pos = prim.getAttribute('POSITION')?.getArray();
    if (!pos) continue;
    const idx = prim.getIndices()?.getArray();
    const indices = idx ? Uint32Array.from(idx) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
    out.push({ positions: applyMat4(pos, world), indices });
  }
  return out;
}

function findRoot(nodes: readonly GltfNode[], rule: OrganRule, prefix: string): GltfNode | undefined {
  for (const r of rule.roots) {
    const name = r.replace('{P}', prefix);
    const n = nodes.find((x) => x.getName() === name);
    if (n) return n;
  }
  return undefined;
}

interface BuiltOrgan {
  id: string;
  mesh: RawMesh;
  sourceTriangles: number;
}

async function buildBody(io: NodeIO, sex: Sex) {
  const src = SOURCES[sex];
  const file = join(root, src.file);
  if (!existsSync(file)) throw new Error(`Missing ${src.file}. Download it from ${src.url}`);
  console.log(`[${sex}] reading ${src.file} (${(statSync(file).size / 1e6).toFixed(0)} MB)`);
  const doc = await io.read(file);
  const nodes = doc.getRoot().listNodes();
  const prefix = sex === 'male' ? 'VH_M' : 'VH_F';

  const built: BuiltOrgan[] = [];
  const missing: string[] = [];
  for (const rule of ORGAN_RULES) {
    const start = findRoot(nodes, rule, prefix);
    if (!start) {
      console.warn(`[${sex}] ${rule.id}: no node ${rule.roots.join(' | ')} — hotspot without mesh`);
      missing.push(rule.id);
      continue;
    }
    let items = collect(start);
    if (rule.exclude) items = items.filter((i) => !rule.exclude?.test(i.path));
    if (rule.include) {
      const inc = items.filter((i) => rule.include?.test(i.path));
      if (inc.length > 0) items = inc;
      else
        console.warn(
          `[${sex}] ${rule.id}: include ${String(rule.include)} matched nothing; using the whole subtree`,
        );
    }
    const merged = mergeMeshes(items.flatMap((i) => nodeMeshes(i.node)));
    if (merged.indices.length === 0) {
      console.warn(`[${sex}] ${rule.id}: no triangles — hotspot without mesh`);
      missing.push(rule.id);
      continue;
    }
    const welded = weld(merged);
    const simple = await simplifyTo(welded, rule.budget);
    built.push({ id: rule.id, mesh: simple, sourceTriangles: merged.indices.length / 3 });
    console.log(
      `[${sex}] ${rule.id.padEnd(8)} ${items.length} meshes, ${merged.indices.length / 3} → ${simple.indices.length / 3} triangles`,
    );
  }

  // Normalise: feet at y = 0, centred on x/z using the skin (or everything when there is no skin).
  const ref =
    built.find((b) => b.id === 'skin')?.mesh.positions ?? mergeMeshes(built.map((b) => b.mesh)).positions;
  const b = bounds(ref);
  const dx = -((b.min[0] + b.max[0]) / 2);
  const dy = -b.min[1];
  const dz = -((b.min[2] + b.max[2]) / 2);
  for (const o of built) translate(o.mesh.positions, dx, dy, dz);
  const height = b.max[1] - b.min[1];

  // Fresh document: one node, mesh, primitive and material per organ.
  const out = new Document();
  out.getRoot().getAsset().generator = 'ARGUS scripts/build-anatomy.ts (glTF-Transform)';
  out.getRoot().getAsset().copyright = ATTRIBUTION[0];
  const buffer = out.createBuffer();
  const scene = out.createScene(sex);
  let triangles = 0;
  for (const o of built) {
    const normals = new Float32Array(vertexNormals(o.mesh));
    const positions = new Float32Array(o.mesh.positions);
    const vCount = o.mesh.positions.length / 3;
    const indexArray = vCount < 65_536 ? Uint16Array.from(o.mesh.indices) : Uint32Array.from(o.mesh.indices);
    const prim = out
      .createPrimitive()
      .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
      .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer))
      .setIndices(out.createAccessor().setType('SCALAR').setArray(indexArray).setBuffer(buffer))
      .setMaterial(
        out.createMaterial(`mat-${o.id}`).setBaseColorFactor([0.48, 0.56, 0.64, 1]).setRoughnessFactor(0.6),
      );
    const mesh = out.createMesh(o.id).addPrimitive(prim);
    scene.addChild(out.createNode(o.id).setMesh(mesh));
    triangles += o.mesh.indices.length / 3;
  }
  if (triangles > MAX_TRIANGLES) throw new Error(`[${sex}] ${triangles} triangles > ${MAX_TRIANGLES}`);

  await MeshoptEncoder.ready;
  await out.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const glb = await io.writeBinary(out);
  const outFile = join(OUT_DIR, `${sex}.glb`);
  writeFileSync(outFile, glb);
  console.log(
    `[${sex}] wrote public/anatomy/${sex}.glb: ${triangles} triangles, ${(glb.byteLength / 1e6).toFixed(2)} MB, height ${height.toFixed(3)} m`,
  );
  return {
    file: `${sex}.glb`,
    bytes: glb.byteLength,
    triangles,
    heightM: Number(height.toFixed(3)),
    nodes: built.map((o) => o.id),
    missing,
    source: { url: src.url, doi: src.doi, title: src.title },
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const only = process.argv[2] as Sex | undefined;
  const sexes: Sex[] = only ? [only] : ['male', 'female'];
  type Body = Awaited<ReturnType<typeof buildBody>>;
  // Building one body keeps the other body's manifest entry.
  const manifestFile = join(OUT_DIR, 'manifest.json');
  const previous = existsSync(manifestFile)
    ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as { bodies?: Record<string, Body> }).bodies
    : undefined;
  const bodies: Record<string, Body> = only && previous ? { ...previous } : {};
  for (const sex of sexes) bodies[sex] = await buildBody(io, sex);

  const total = Object.values(bodies).reduce((n, b) => n + b.bytes, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error(`public/anatomy total ${total} bytes > 8 MB`);
  const manifest = {
    build: new Date().toISOString(),
    triangles: Object.fromEntries(Object.entries(bodies).map(([k, v]) => [k, v.triangles])),
    nodes: Object.fromEntries(Object.entries(bodies).map(([k, v]) => [k, v.nodes])),
    bodies,
    attribution: ATTRIBUTION,
    license: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
    sourceIds: ['SRC_HRA_3D'],
  };
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote public/anatomy/manifest.json (total ${(total / 1e6).toFixed(2)} MB)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
