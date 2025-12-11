import './style.css'
import { Viewport3D } from './Viewport3D'
import { SketchEditor } from './SketchEditor'
import { SketchPlane } from './SketchPlane'
import { PlaneSelector } from './PlaneSelector'

// Set up HTML structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="viewport-3d"></div>
  <div id="viewport-2d"></div>
`

// Get container elements
const viewport3dContainer = document.querySelector<HTMLDivElement>('#viewport-3d')!
const viewport2dContainer = document.querySelector<HTMLDivElement>('#viewport-2d')!

// Create viewports
const viewport3d = new Viewport3D(viewport3dContainer)
const sketchEditor = new SketchEditor(viewport2dContainer)

// === CREATE SKETCH PLANES ===

const sketchPlanes = [
  new SketchPlane(4, 0),    // Ground floor
  new SketchPlane(3, 1),    // First floor
  new SketchPlane(2, 2),    // Second floor
]

// Add all planes to the 3D viewport
sketchPlanes.forEach(plane => {
  viewport3d.add(plane.getGroup())
})

// === PLANE SELECTION ===

const planeSelector = new PlaneSelector(viewport3d, sketchPlanes)

// Update 2D editor when plane selection changes
planeSelector.setOnSelectionChange((plane) => {
  sketchEditor.setSketch(plane.getSketch())
})

// Update 3D view when vertices are dragged in 2D editor
sketchEditor.setOnVertexChange((index, position) => {
  const selectedPlane = planeSelector.getSelectedPlane()
  if (selectedPlane) {
    selectedPlane.setVertex(index, position)
  }
})

// Select the first plane by default
planeSelector.selectPlane(sketchPlanes[0])

// === ANIMATION LOOP ===

function animate() {
  requestAnimationFrame(animate)

  // Render both viewports
  viewport3d.render()
  sketchEditor.render()
}

// === WINDOW RESIZE HANDLER ===

window.addEventListener('resize', () => {
  viewport3d.resize()
  sketchEditor.resize()
})

animate()
