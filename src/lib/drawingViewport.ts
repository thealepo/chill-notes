import type { ElementBounds } from './drawingScene'
import type { DrawingViewport } from './drawingRender'

export interface ViewportSize {
  width: number
  height: number
}

export interface ViewportPoint {
  x: number
  y: number
}

export const MIN_DRAWING_ZOOM = 0.25
export const MAX_DRAWING_ZOOM = 3
export const DEFAULT_DRAWING_VIEWPORT: DrawingViewport = { x: 48, y: 42, zoom: 1 }

export function clampDrawingZoom(value: number): number {
  return Math.min(MAX_DRAWING_ZOOM, Math.max(MIN_DRAWING_ZOOM, value))
}

export function zoomDrawingViewport(
  viewport: DrawingViewport,
  anchor: ViewportPoint,
  factor: number,
): DrawingViewport {
  const worldX = (anchor.x - viewport.x) / viewport.zoom
  const worldY = (anchor.y - viewport.y) / viewport.zoom
  const zoom = clampDrawingZoom(viewport.zoom * factor)
  return {
    x: anchor.x - worldX * zoom,
    y: anchor.y - worldY * zoom,
    zoom,
  }
}

export function panDrawingViewport(
  viewport: DrawingViewport,
  deltaX: number,
  deltaY: number,
): DrawingViewport {
  return { ...viewport, x: viewport.x - deltaX, y: viewport.y - deltaY }
}

export function fitDrawingViewport(
  bounds: ElementBounds | null,
  size: ViewportSize,
  padding = 64,
): DrawingViewport {
  if (!bounds) return { ...DEFAULT_DRAWING_VIEWPORT }
  const zoom = clampDrawingZoom(Math.min(
    (size.width - padding * 2) / bounds.width,
    (size.height - padding * 2) / bounds.height,
    1.5,
  ))
  return {
    x: (size.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (size.height - bounds.height * zoom) / 2 - bounds.y * zoom,
    zoom,
  }
}
