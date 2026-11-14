// Which HRA nodes become which stable organ node (doc 12 §3), with a triangle budget per organ.
// Names are from the HRA 3D Reference Organ "united" bodies v1.10 (VH_M_* male, VH_F_* female, Allen_* brain).

export type Sex = 'male' | 'female';

export interface OrganRule {
  /** Stable node id written to the GLB (doc 12 §3). */
  id: string;
  /** Root node names to take (first that exists wins); `{P}` = VH_M / VH_F. */
  roots: string[];
  /** Keep only meshes whose node name (or an ancestor below the root) matches; falls back to all if nothing matches. */
  include?: RegExp;
  /** Drop meshes whose node name (or an ancestor below the root) matches. */
  exclude?: RegExp;
  /** Target triangle count after simplification. */
  budget: number;
}

/** Budgets sum to 139k triangles per body (≤ 150k, doc 12 §3). */
export const ORGAN_RULES: readonly OrganRule[] = [
  { id: 'skin', roots: ['{P}_skin'], budget: 60_000 },
  {
    id: 'brain',
    roots: ['Allen_brain'],
    exclude: /white_matter|corpus_callosum|optic_chiasm/,
    budget: 10_000,
  },
  { id: 'eye_l', roots: ['{P}_eye_L'], include: /sclera|cornea|iris/, budget: 1_500 },
  { id: 'eye_r', roots: ['{P}_eye_R'], include: /sclera|cornea|iris/, budget: 1_500 },
  { id: 'heart', roots: ['{P}_heart'], exclude: /valve|papillary/, budget: 9_000 },
  { id: 'lung_l', roots: ['{P}_lungs_L', '{P}_left_lungs_L'], exclude: /hilum/, budget: 6_000 },
  { id: 'lung_r', roots: ['{P}_lungs_R'], exclude: /hilum/, budget: 6_000 },
  { id: 'aorta', roots: ['{P}_aorta'], budget: 3_500 },
  { id: 'liver', roots: ['{P}_liver'], include: /liver_capsule/, budget: 5_000 },
  { id: 'pancreas', roots: ['{P}_pancreas'], budget: 2_500 },
  { id: 'kidney_l', roots: ['{P}_left_kidney'], include: /kidney_capsule/, budget: 2_500 },
  { id: 'kidney_r', roots: ['{P}_right_kidney'], include: /kidney_capsule/, budget: 2_500 },
  { id: 'bladder', roots: ['{P}_urinary_bladder'], budget: 2_000 },
  {
    id: 'spine',
    roots: ['{P}_vertebral_column'],
    include: /vertebra/,
    exclude: /intervertebral/,
    budget: 14_000,
  },
  { id: 'pelvis', roots: ['{P}_pelvis'], budget: 7_000 },
  { id: 'femur_l', roots: ['{P}_femur_L'], budget: 3_000 },
  { id: 'femur_r', roots: ['{P}_femur_R'], budget: 3_000 },
];

export const SOURCES: Record<Sex, { file: string; url: string; doi: string; title: string }> = {
  male: {
    file: 'assets-src/hra/male-united.glb',
    url: 'https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.10/assets/3d-vh-m-united.glb',
    doi: 'https://doi.org/10.48539/HBM833.WZWN.425',
    title: '3D Reference Organ Set for Male, v1.10',
  },
  female: {
    file: 'assets-src/hra/female-united.glb',
    url: 'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb',
    doi: 'https://doi.org/10.48539/HBM637.DWBM.744',
    title: '3D Reference Organ Set for Female, v1.10',
  },
};

export const ATTRIBUTION: readonly string[] = [
  'HRA 3D Reference Organs (Visible Human male and female united bodies, v1.10), HuBMAP — CC BY 4.0 ' +
    '(https://creativecommons.org/licenses/by/4.0/). Browne, Kristen, and Heidi Schlehlein. 2026. 3D Reference Organ ' +
    'Set for Male, v1.10. https://doi.org/10.48539/HBM833.WZWN.425; 3D Reference Organ Set for Female, v1.10. ' +
    'https://doi.org/10.48539/HBM637.DWBM.744.',
  'Source data: Visible Human Project, U.S. National Library of Medicine.',
  'Modified for ARGUS: selected organs only, merged per organ, simplified, re-centred and compressed ' +
    '(scripts/build-anatomy.ts).',
];
