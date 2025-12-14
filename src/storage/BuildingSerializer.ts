import * as THREE from 'three'
import { SketchPlane } from '../3d/SketchPlane'
import { DEFAULT_BUILDING_SIZE } from '../constants'
import { Model } from '../model/Model'
import type { BuildingData } from './BuildingTypes'

/**
 * Serializes Model to/from BuildingData format.
 */
export class BuildingSerializer {
  /**
   * Convert Model to BuildingData for saving.
   */
  static serialize(model: Model): BuildingData {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    const planeData = model.planes.map(plane => {
      const z = plane.getHeight()
      const vertices = plane.getVertices()

      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)

      const verts: [number, number][] = vertices.map(v => {
        minX = Math.min(minX, v.x)
        minY = Math.min(minY, v.y)
        maxX = Math.max(maxX, v.x)
        maxY = Math.max(maxY, v.y)
        return [v.x, v.y]
      })

      return { z, vertices: verts }
    })

    return {
      version: 1,
      name: model.name,
      bounds: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ]
      },
      planes: planeData,
      segmentLocked: [...model.segmentLocked]
    }
  }

  /**
   * Convert BuildingData to Model for loading.
   */
  static deserialize(data: BuildingData): Model {
    const planes = data.planes.map(planeData => {
      const vertices = planeData.vertices.map(([x, y]) => new THREE.Vector2(x, y))
      const plane = new SketchPlane(DEFAULT_BUILDING_SIZE, planeData.z)
      plane.setVertices(vertices)
      return plane
    })

    const model = new Model(data.name, planes)

    // Restore segment lock states if present
    if (data.segmentLocked) {
      for (let i = 0; i < data.segmentLocked.length && i < model.segmentLocked.length; i++) {
        model.segmentLocked[i] = data.segmentLocked[i]
      }
    }

    return model
  }
}
