import * as THREE from 'three'
import { Sketch } from './Sketch'

/**
 * Manages the 2D sketch editor viewport for creating and editing profiles
 */
export class SketchEditor {
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private frustumSize: number = 10
  private currentSketch: Sketch | null = null

  constructor(container: HTMLElement) {
    this.container = container

    // Create scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x2a2a2a)

    // Create orthographic camera for 2D view
    const aspect = container.clientWidth / container.clientHeight
    this.camera = new THREE.OrthographicCamera(
      -this.frustumSize * aspect / 2,
      this.frustumSize * aspect / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.1,
      100
    )
    this.camera.position.z = 5

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)
  }

  /**
   * Set the sketch to display and edit
   */
  setSketch(sketch: Sketch): void {
    this.clear()
    this.currentSketch = sketch
    this.scene.add(sketch.getEditorGroup())
  }

  /**
   * Get the current sketch
   */
  getSketch(): Sketch | null {
    return this.currentSketch
  }

  /**
   * Clear the scene
   */
  clear(): void {
    if (this.currentSketch) {
      this.scene.remove(this.currentSketch.getEditorGroup())
      this.currentSketch = null
    }
  }

  /**
   * Render the scene
   */
  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Handle window resize
   */
  resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    const aspect = width / height

    this.camera.left = -this.frustumSize * aspect / 2
    this.camera.right = this.frustumSize * aspect / 2
    this.camera.top = this.frustumSize / 2
    this.camera.bottom = -this.frustumSize / 2
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
  }

  /**
   * Get the camera for external access
   */
  getCamera(): THREE.OrthographicCamera {
    return this.camera
  }

  /**
   * Get the scene for direct access if needed
   */
  getScene(): THREE.Scene {
    return this.scene
  }
}
