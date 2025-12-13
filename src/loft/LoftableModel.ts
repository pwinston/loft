/**
 * LoftableModel.ts
 *
 * Represents a lofted shape as a collection of segments,
 * where each segment contains the mesh faces connecting two planes.
 */

import * as THREE from 'three'
import { SketchPlane } from '../3d/SketchPlane'
import { getLoftAlgorithm } from './LoftAlgorithm'
import type { LoftFace } from './LoftAlgorithm'
import { LOFT } from '../constants'

// Import algorithms to register them
import './PerimeterWalkAlgorithm'

/**
 * A single floor-to-floor segment containing mesh faces.
 */
export class LoftSegment {
  /** Bottom plane reference */
  bottomPlane: SketchPlane

  /** Top plane reference */
  topPlane: SketchPlane

  /** Mesh faces (quads and triangles) connecting the two planes */
  faces: LoftFace[]

  constructor(
    bottomPlane: SketchPlane,
    topPlane: SketchPlane,
    faces: LoftFace[]
  ) {
    this.bottomPlane = bottomPlane
    this.topPlane = topPlane
    this.faces = faces
  }

  getBottomHeight(): number {
    return this.bottomPlane.getHeight()
  }

  getTopHeight(): number {
    return this.topPlane.getHeight()
  }
}

/**
 * A loftable model consisting of segments between adjacent planes.
 */
export class LoftableModel {
  segments: LoftSegment[]

  constructor(segments: LoftSegment[]) {
    this.segments = segments
  }

  /**
   * Create a LoftableModel from an array of sketch planes.
   * Uses the specified algorithm to generate mesh faces for each segment.
   */
  static fromPlanes(planes: SketchPlane[], algorithmName?: string): LoftableModel {
    if (planes.length < 2) {
      return new LoftableModel([])
    }

    // Sort planes by height
    const sortedPlanes = [...planes].sort((a, b) => a.getHeight() - b.getHeight())

    const name = algorithmName ?? LOFT.DEFAULT_ALGORITHM ?? 'perimeter-walk'
    const algorithm = getLoftAlgorithm(name)

    if (!algorithm) {
      console.warn(`Unknown loft algorithm: ${name}, using perimeter-walk`)
      const fallback = getLoftAlgorithm('perimeter-walk')
      if (!fallback) {
        throw new Error('No loft algorithms registered')
      }
      return LoftableModel.buildSegments(sortedPlanes, fallback)
    }

    return LoftableModel.buildSegments(sortedPlanes, algorithm)
  }

  /**
   * Build segments pairwise using the given algorithm.
   */
  private static buildSegments(
    planes: SketchPlane[],
    algorithm: (
      loopA: THREE.Vector2[],
      heightA: number,
      loopB: THREE.Vector2[],
      heightB: number
    ) => { faces: LoftFace[] }
  ): LoftableModel {
    const segments: LoftSegment[] = []

    for (let i = 0; i < planes.length - 1; i++) {
      const bottomPlane = planes[i]
      const topPlane = planes[i + 1]

      const result = algorithm(
        bottomPlane.getSketch().getVertices(),
        bottomPlane.getHeight(),
        topPlane.getSketch().getVertices(),
        topPlane.getHeight()
      )

      segments.push(new LoftSegment(bottomPlane, topPlane, result.faces))
    }

    return new LoftableModel(segments)
  }

  /**
   * Get the roof vertices (top of the last segment).
   * Returns null if there are no segments.
   */
  getRoofVertices(): THREE.Vector2[] | null {
    if (this.segments.length === 0) return null
    const topPlane = this.segments[this.segments.length - 1].topPlane
    return topPlane.getSketch().getVertices()
  }

  /**
   * Get the roof height (top of the last segment).
   */
  getRoofHeight(): number {
    if (this.segments.length === 0) return 0
    return this.segments[this.segments.length - 1].getTopHeight()
  }

  /**
   * Get all planes in order (bottom to top).
   */
  getPlanes(): SketchPlane[] {
    if (this.segments.length === 0) return []
    const planes = [this.segments[0].bottomPlane]
    for (const segment of this.segments) {
      planes.push(segment.topPlane)
    }
    return planes
  }
}
