/**
 * Model.ts
 *
 * The central data structure representing a lofted 3D shape.
 * Contains planes (2D sketches at different heights) and metadata
 * about the segments connecting them.
 */

import { SketchPlane } from '../3d/SketchPlane'

/**
 * A Model is the core data structure for a lofted shape.
 * It owns the planes and segment metadata (like lock state).
 */
export class Model {
  /** The name of this model */
  name: string

  /** The sketch planes (floors) that define the shape */
  planes: SketchPlane[]

  /** Lock state for each segment (length = planes.length - 1) */
  segmentLocked: boolean[]

  constructor(name: string, planes: SketchPlane[] = []) {
    this.name = name
    this.planes = planes
    this.segmentLocked = this.createSegmentLockArray()
  }

  /**
   * Create a properly-sized segment lock array (all unlocked)
   */
  private createSegmentLockArray(): boolean[] {
    const segmentCount = Math.max(0, this.planes.length - 1)
    return new Array(segmentCount).fill(false)
  }

  /**
   * Get the number of segments (planes.length - 1)
   */
  getSegmentCount(): number {
    return Math.max(0, this.planes.length - 1)
  }

  /**
   * Check if a segment is locked
   */
  isSegmentLocked(index: number): boolean {
    return this.segmentLocked[index] ?? false
  }

  /**
   * Set lock state for a segment
   */
  setSegmentLocked(index: number, locked: boolean): void {
    if (index >= 0 && index < this.segmentLocked.length) {
      this.segmentLocked[index] = locked
    }
  }

  /**
   * Add a plane and update segment lock array
   */
  addPlane(plane: SketchPlane): void {
    this.planes.push(plane)
    this.syncSegmentLockArray()
  }

  /**
   * Remove a plane and update segment lock array
   */
  removePlane(plane: SketchPlane): boolean {
    const index = this.planes.indexOf(plane)
    if (index === -1) return false

    this.planes.splice(index, 1)
    this.syncSegmentLockArray()
    return true
  }

  /**
   * Sync the segment lock array to match current plane count.
   * Preserves existing lock states where possible.
   */
  private syncSegmentLockArray(): void {
    const segmentCount = this.getSegmentCount()

    // Add false for new segments
    while (this.segmentLocked.length < segmentCount) {
      this.segmentLocked.push(false)
    }

    // Trim if planes were removed
    this.segmentLocked.length = segmentCount
  }

  /**
   * Get planes sorted by height (bottom to top)
   */
  getPlanesSortedByHeight(): SketchPlane[] {
    return [...this.planes].sort((a, b) => a.getHeight() - b.getHeight())
  }
}
