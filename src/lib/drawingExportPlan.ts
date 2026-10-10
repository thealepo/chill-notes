import type { DrawingElement, DrawingScene, ElementBounds } from './drawingScene'
import type { DrawingViewport } from './drawingRender'

const EXPORT_PADDING = 64
const DEFAULT_EXPORT_BOUNDS: ElementBounds = { x: 0, y: 0, width: 1200, height: 720 }
const MIN_EXPORT_WIDTH = 320
const MIN_EXPORT_HEIGHT = 240
const MAX_EXPORT_DIMENSION = 4096
const MAX_EXPORT_SCALE = 2

export interface DrawingExportPlan {
  scene: DrawingScene
  content: ElementBounds
  width: number
  height: number
  scale: number
  pixelWidth: number
  pixelHeight: number
  viewport: DrawingViewport
  unavailableImageCount: number
}

function contentBounds(elements: DrawingElement[]): ElementBounds | null {
  if (elements.length === 0) return null
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const element of elements) {
    const x = Math.min(element.x, element.x + element.width)
    const y = Math.min(element.y, element.y + element.height)
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x + Math.abs(element.width))
    bottom = Math.max(bottom, y + Math.abs(element.height))
  }

  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

export function createDrawingExportPlan(
  scene: DrawingScene,
  unavailableImageIds: ReadonlySet<string> = new Set(),
): DrawingExportPlan {
  const elements = scene.elements.filter((element) => (
    element.type !== 'image' || !unavailableImageIds.has(element.id)
  ))
  const exportScene = elements.length === scene.elements.length ? scene : { ...scene, elements }
  const content = contentBounds(elements) ?? DEFAULT_EXPORT_BOUNDS
  const width = Math.max(MIN_EXPORT_WIDTH, content.width + EXPORT_PADDING * 2)
  const height = Math.max(MIN_EXPORT_HEIGHT, content.height + EXPORT_PADDING * 2)
  const scale = Math.min(MAX_EXPORT_SCALE, MAX_EXPORT_DIMENSION / Math.max(width, height))

  return {
    scene: exportScene,
    content,
    width,
    height,
    scale,
    pixelWidth: Math.ceil(width * scale),
    pixelHeight: Math.ceil(height * scale),
    viewport: { x: EXPORT_PADDING - content.x, y: EXPORT_PADDING - content.y, zoom: 1 },
    unavailableImageCount: scene.elements.length - elements.length,
  }
}
