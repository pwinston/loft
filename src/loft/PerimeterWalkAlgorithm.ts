/**
 * PerimeterWalkAlgorithm.ts
 *
 * Connects two 2D loops by "walking" both perimeters simultaneously.
 *
 * CONCEPT:
 * --------
 * Think of both outlines as parameterized by normalized perimeter distance [0, 1].
 * We walk both loops together, advancing whichever loop has the next vertex
 * (by perimeter parameter). This creates quads when both advance together,
 * or subdivided quads when one advances ahead of the other.
 *
 * ALGORITHM:
 * ----------
 * 1. Compute cumulative perimeter distance for each vertex (normalized 0..1)
 * 2. Start at vertex 0 on both loops
 * 3. At each step, look at the parameter of the next vertex on each loop
 * 4. Advance whichever is smaller (or both if equal), creating a quad
 * 5. When one advances alone, we interpolate a point on the other loop's edge
 */

import * as THREE from 'three'
import { registerLoftAlgorithm } from './LoftAlgorithm'
import type { LoftFace, LoftResult } from './LoftAlgorithm'
import { ensureWindingCCW } from '../util/Geometry'

// ============================================================================
// HELPER: ParameterizedLoop
// ============================================================================

/**
 * A closed loop of 2D vertices with precomputed perimeter parameters.
 *
 * Each vertex has a "parameter" t in [0, 1] representing how far around
 * the perimeter it is (by arc length).
 */
class ParameterizedLoop {
  /** Original vertices (CCW winding) */
  readonly vertices: THREE.Vector2[]

  /** Cumulative perimeter parameter for each vertex, normalized to [0, 1] */
  readonly params: number[]

  /** Total perimeter length */
  readonly totalLength: number

  constructor(vertices: THREE.Vector2[]) {
    // Ensure consistent CCW winding
    this.vertices = ensureWindingCCW(vertices)

    // Compute cumulative distances
    const n = this.vertices.length
    const distances: number[] = [0]
    let total = 0

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n
      const edgeLength = this.vertices[i].distanceTo(this.vertices[next])
      total += edgeLength
      if (i < n - 1) {
        distances.push(total)
      }
    }

    this.totalLength = total

    // Normalize to [0, 1]
    this.params = distances.map(d => (total > 0 ? d / total : 0))
  }

  /** Number of vertices in the loop */
  get count(): number {
    return this.vertices.length
  }

  /**
   * Get the parameter for vertex at index i.
   * Handles wrap-around: param(n) = 1.0
   */
  param(i: number): number {
    const n = this.count
    if (i >= n) return 1.0
    return this.params[i]
  }

  /**
   * Get vertex at index (with wrap-around).
   */
  vertex(i: number): THREE.Vector2 {
    return this.vertices[i % this.count]
  }

  /**
   * Interpolate a point on edge (i → i+1) at parameter t.
   * t should be in [param(i), param(i+1)]
   */
  interpolate(i: number, t: number): THREE.Vector2 {
    const v0 = this.vertex(i)
    const v1 = this.vertex(i + 1)

    const t0 = this.param(i)
    const t1 = this.param(i + 1)

    // Handle wrap-around edge
    const span = t1 > t0 ? t1 - t0 : (1 - t0) + t1

    if (span === 0) return v0.clone()

    // u is [0,1] within this edge
    const u = (t - t0) / span

    return new THREE.Vector2(
      v0.x + u * (v1.x - v0.x),
      v0.y + u * (v1.y - v0.y)
    )
  }
}

// ============================================================================
// HELPER: FaceBuilder
// ============================================================================

/**
 * Builds 3D faces from 2D points at different heights.
 */
class FaceBuilder {
  private faces: LoftFace[] = []
  private heightA: number
  private heightB: number

  constructor(heightA: number, heightB: number) {
    this.heightA = heightA
    this.heightB = heightB
  }

  /**
   * Convert a 2D point on loop A to 3D (at heightA).
   */
  private toPoint3D_A(p: THREE.Vector2): THREE.Vector3 {
    return new THREE.Vector3(p.x, p.y, this.heightA)
  }

  /**
   * Convert a 2D point on loop B to 3D (at heightB).
   */
  private toPoint3D_B(p: THREE.Vector2): THREE.Vector3 {
    return new THREE.Vector3(p.x, p.y, this.heightB)
  }

  /**
   * Add a quad face connecting two edges.
   *
   * Vertices should be in order: a0, a1 (from loop A), b1, b0 (from loop B)
   * This creates proper winding for outward-facing normals.
   *
   *    a0 -------- a1
   *    |          |
   *    |   QUAD   |
   *    |          |
   *    b0 -------- b1
   */
  addQuad(
    a0: THREE.Vector2,
    a1: THREE.Vector2,
    b0: THREE.Vector2,
    b1: THREE.Vector2
  ): void {
    this.faces.push({
      vertices: [
        this.toPoint3D_A(a0),
        this.toPoint3D_A(a1),
        this.toPoint3D_B(b1),
        this.toPoint3D_B(b0)
      ]
    })
  }

  /**
   * Add a triangle face.
   * Vertices in winding order for outward-facing normal.
   */
  addTriangle(
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3
  ): void {
    this.faces.push({
      vertices: [p0, p1, p2]
    })
  }

  /**
   * Get all built faces.
   */
  getFaces(): LoftFace[] {
    return this.faces
  }
}

// ============================================================================
// MAIN ALGORITHM: Perimeter Walk
// ============================================================================

/**
 * Walk two loops simultaneously, creating faces as we go.
 *
 * At each step we compare the parameter of the next vertex on each loop
 * and advance the one that comes first (or both if equal).
 */
function walkPerimeters(
  loopA: ParameterizedLoop,
  loopB: ParameterizedLoop,
  builder: FaceBuilder
): void {
  let iA = 0 // Current vertex index on loop A
  let iB = 0 // Current vertex index on loop B

  const nA = loopA.count
  const nB = loopB.count

  // We're done when we've visited all vertices on both loops
  while (iA < nA || iB < nB) {
    // Parameter of the NEXT vertex on each loop
    const tNextA = loopA.param(iA + 1)
    const tNextB = loopB.param(iB + 1)

    // Current vertices
    const a0 = loopA.vertex(iA)
    const b0 = loopB.vertex(iB)

    // Small epsilon for floating point comparison
    const EPS = 1e-9

    if (iA >= nA) {
      // Loop A is done, only advance B
      const b1 = loopB.vertex(iB + 1)
      const a1 = loopA.interpolate(nA - 1, tNextB) // Stay on last edge of A
      builder.addQuad(a0, a1, b0, b1)
      iB++
    } else if (iB >= nB) {
      // Loop B is done, only advance A
      const a1 = loopA.vertex(iA + 1)
      const b1 = loopB.interpolate(nB - 1, tNextA) // Stay on last edge of B
      builder.addQuad(a0, a1, b0, b1)
      iA++
    } else if (Math.abs(tNextA - tNextB) < EPS) {
      // CASE 1: Both reach their next vertex at the same parameter
      // Create a clean quad, advance both
      const a1 = loopA.vertex(iA + 1)
      const b1 = loopB.vertex(iB + 1)
      builder.addQuad(a0, a1, b0, b1)
      iA++
      iB++
    } else if (tNextA < tNextB) {
      // CASE 2: A's next vertex comes before B's
      // Interpolate a point on B's current edge, advance A only
      const a1 = loopA.vertex(iA + 1)
      const b1 = loopB.interpolate(iB, tNextA)
      builder.addQuad(a0, a1, b0, b1)
      iA++
    } else {
      // CASE 3: B's next vertex comes before A's
      // Interpolate a point on A's current edge, advance B only
      const a1 = loopA.interpolate(iA, tNextB)
      const b1 = loopB.vertex(iB + 1)
      builder.addQuad(a0, a1, b0, b1)
      iB++
    }
  }
}

// ============================================================================
// HELPER: Align Starting Points
// ============================================================================

/**
 * Find the vertex in loopB that is closest to vertex 0 of loopA.
 * Returns the index in loopB.
 */
function findClosestVertexIndex(
  loopA: THREE.Vector2[],
  loopB: THREE.Vector2[]
): number {
  const target = loopA[0]
  let bestIndex = 0
  let bestDist = Infinity

  for (let i = 0; i < loopB.length; i++) {
    const dist = target.distanceTo(loopB[i])
    if (dist < bestDist) {
      bestDist = dist
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Rotate an array so that the element at startIndex becomes index 0.
 */
function rotateArray<T>(arr: T[], startIndex: number): T[] {
  if (startIndex === 0 || arr.length === 0) return arr
  return [...arr.slice(startIndex), ...arr.slice(0, startIndex)]
}

/**
 * Align loopB's starting vertex to be closest to loopA's starting vertex.
 * This prevents twisting when the loops have different vertex positions.
 */
function alignLoopStarts(
  loopA: THREE.Vector2[],
  loopB: THREE.Vector2[]
): THREE.Vector2[] {
  const closestIndex = findClosestVertexIndex(loopA, loopB)
  return rotateArray(loopB, closestIndex)
}

// ============================================================================
// ALGORITHM ENTRY POINT
// ============================================================================

/**
 * Perimeter Walk Loft Algorithm
 *
 * Creates a mesh connecting two 2D loops by walking their perimeters
 * in sync, parameterized by arc length.
 *
 * Key properties:
 * - Produces mostly quads (good for rendering)
 * - Handles loops with different vertex counts
 * - Preserves the shape of both loops (no resampling/distortion)
 * - Vertices are connected based on their relative position along the perimeter
 */
function perimeterWalkAlgorithm(
  loopA: THREE.Vector2[],
  heightA: number,
  loopB: THREE.Vector2[],
  heightB: number
): LoftResult {
  // Handle edge cases
  if (loopA.length < 3 || loopB.length < 3) {
    return { faces: [] }
  }

  // Normalize winding to CCW
  const normalizedA = ensureWindingCCW(loopA)
  const normalizedB = ensureWindingCCW(loopB)

  // Align loopB's start to be closest to loopA's start
  const alignedB = alignLoopStarts(normalizedA, normalizedB)

  // Create parameterized loops (note: ParameterizedLoop also calls ensureWindingCCW,
  // but since we already did it, it's a no-op)
  const paramA = new ParameterizedLoop(normalizedA)
  const paramB = new ParameterizedLoop(alignedB)

  // Build faces
  const builder = new FaceBuilder(heightA, heightB)
  walkPerimeters(paramA, paramB, builder)

  return { faces: builder.getFaces() }
}

// Register the algorithm
registerLoftAlgorithm('perimeter-walk', perimeterWalkAlgorithm)

export { perimeterWalkAlgorithm, ParameterizedLoop, FaceBuilder }
