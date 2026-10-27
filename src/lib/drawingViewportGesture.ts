import type { DrawingViewport } from './drawingRender'

export interface ViewportGesturePoint {
  x: number
  y: number
}

export interface ViewportGestureSnapshot {
  viewport: DrawingViewport
  midpoint: ViewportGesturePoint
  distance: number
  worldAnchor: ViewportGesturePoint
}

function midpoint(first: ViewportGesturePoint, second: ViewportGesturePoint): ViewportGesturePoint {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

function distance(first: ViewportGesturePoint, second: ViewportGesturePoint): number {
  return Math.max(1, Math.hypot(second.x - first.x, second.y - first.y))
}

export function beginViewportGesture(
  viewport: DrawingViewport,
  first: ViewportGesturePoint,
  second: ViewportGesturePoint,
): ViewportGestureSnapshot {
  const startMidpoint = midpoint(first, second)
  return {
    viewport: { ...viewport },
    midpoint: startMidpoint,
    distance: distance(first, second),
    worldAnchor: {
      x: (startMidpoint.x - viewport.x) / viewport.zoom,
      y: (startMidpoint.y - viewport.y) / viewport.zoom,
    },
  }
}

export function updateViewportGesture(
  gesture: ViewportGestureSnapshot,
  first: ViewportGesturePoint,
  second: ViewportGesturePoint,
  minimumZoom: number,
  maximumZoom: number,
): DrawingViewport {
  const currentMidpoint = midpoint(first, second)
  const zoom = Math.min(
    maximumZoom,
    Math.max(minimumZoom, gesture.viewport.zoom * distance(first, second) / gesture.distance),
  )
  return {
    x: currentMidpoint.x - gesture.worldAnchor.x * zoom,
    y: currentMidpoint.y - gesture.worldAnchor.y * zoom,
    zoom,
  }
}
