// Head pose and expression for the face fluid-shift scan — docs/09 §2 frame acceptance. Pure functions.
//
// Pose: MediaPipe's facial transformation matrix (outputFacialTransformationMatrixes) is a 4×4 matrix from the
// canonical face to the detected face [SRC_MEDIAPIPE_FACE]. Its `data` is the flattened MatrixData packed_data,
// which MediaPipe stores column-major (element (row r, col c) = data[c * rows + r]). The upper-left 3×3 block is the
// rotation, possibly times a uniform scale; each column is normalised before the angles are read.
//
// Euler convention (documented and unit-tested): R = Ry(yaw) · Rx(pitch) · Rz(roll), i.e. yaw about the vertical
// axis Y, then pitch about X, then roll about the viewing axis Z. Then
//   R[1][2] = −sin(pitch)                → pitch = asin(−R[1][2])
//   R[0][2] =  sin(yaw)·cos(pitch),  R[2][2] = cos(yaw)·cos(pitch)  → yaw = atan2(R[0][2], R[2][2])
//   R[1][0] =  cos(pitch)·sin(roll), R[1][1] = cos(pitch)·cos(roll) → roll = atan2(R[1][0], R[1][1])
// Only |yaw| and |pitch| are used, so the sign conventions of the camera (mirroring) do not matter.
//
// Expression: blendshape scores (outputFaceBlendshapes) — jawOpen, and smile = max(mouthSmileLeft, mouthSmileRight).

export interface MatrixLike {
  rows: number;
  columns: number;
  data: ArrayLike<number>;
}

export interface HeadPose {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

const DEG = 180 / Math.PI;

/** Yaw / pitch / roll in degrees from a 4×4 (or 3×3) column-major transformation matrix; null if unusable. */
export function poseFromMatrix(m: MatrixLike | null | undefined): HeadPose | null {
  if (!m || m.rows < 3 || m.columns < 3 || m.data.length < m.rows * m.columns) return null;
  const at = (r: number, c: number) => m.data[c * m.rows + r] as number;
  // Column norms remove a uniform (or per-axis) scale from the rotation block.
  const norm = [0, 1, 2].map((c) => Math.hypot(at(0, c), at(1, c), at(2, c)));
  if (norm.some((n) => !Number.isFinite(n) || n < 1e-9)) return null;
  const R = (r: number, c: number) => at(r, c) / (norm[c] as number);
  const s = Math.max(-1, Math.min(1, -R(1, 2)));
  return {
    pitchDeg: Math.asin(s) * DEG,
    yawDeg: Math.atan2(R(0, 2), R(2, 2)) * DEG,
    rollDeg: Math.atan2(R(1, 0), R(1, 1)) * DEG,
  };
}

/** Test helper and documentation of the convention: column-major 4×4 data of Ry(yaw)·Rx(pitch)·Rz(roll)·scale. */
export function matrixFromPose(yawDeg: number, pitchDeg: number, rollDeg = 0, scale = 1): MatrixLike {
  const [y, p, r] = [yawDeg / DEG, pitchDeg / DEG, rollDeg / DEG];
  const Ry = [[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]];
  const Rx = [[1, 0, 0], [0, Math.cos(p), -Math.sin(p)], [0, Math.sin(p), Math.cos(p)]];
  const Rz = [[Math.cos(r), -Math.sin(r), 0], [Math.sin(r), Math.cos(r), 0], [0, 0, 1]];
  const el = (M: number[][], r: number, c: number) => (M[r] as number[])[c] as number;
  const mul = (A: number[][], B: number[][]) =>
    [0, 1, 2].map((r) => [0, 1, 2].map((c) => [0, 1, 2].reduce((acc, k) => acc + el(A, r, k) * el(B, k, c), 0)));
  const R = mul(mul(Ry, Rx), Rz);
  const data: number[] = [];
  for (let c = 0; c < 4; c++)
    for (let row = 0; row < 4; row++) data.push(c < 3 && row < 3 ? el(R, row, c) * scale : c === row ? 1 : 0);
  return { rows: 4, columns: 4, data };
}

export interface Expression {
  jawOpen: number;
  smile: number;
}

/** jawOpen and smile from MediaPipe blendshape categories; null when either is missing. */
export function expressionFromBlendshapes(
  categories: ReadonlyArray<{ categoryName: string; score: number }> | null | undefined,
): Expression | null {
  if (!categories || categories.length === 0) return null;
  const score = (name: string) => categories.find((c) => c.categoryName === name)?.score;
  const jaw = score('jawOpen');
  const l = score('mouthSmileLeft');
  const r = score('mouthSmileRight');
  if (jaw === undefined || (l === undefined && r === undefined)) return null;
  return { jawOpen: jaw, smile: Math.max(l ?? 0, r ?? 0) };
}
