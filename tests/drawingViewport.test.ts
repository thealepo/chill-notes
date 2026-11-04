import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_DRAWING_VIEWPORT,
  fitDrawingViewport,
  panDrawingViewport,
  zoomDrawingViewport,
} from '../src/lib/drawingViewport.ts'

test('zooming keeps the world point beneath the anchor fixed', () => {
  const viewport = { x: 20, y: 10, zoom: 1 }
  const anchor = { x: 120, y: 90 }
  const zoomed = zoomDrawingViewport(viewport, anchor, 2)

  assert.deepEqual(zoomed, { x: -80, y: -70, zoom: 2 })
  assert.equal((anchor.x - zoomed.x) / zoomed.zoom, (anchor.x - viewport.x) / viewport.zoom)
  assert.equal((anchor.y - zoomed.y) / zoomed.zoom, (anchor.y - viewport.y) / viewport.zoom)
})

test('zooming clamps at both viewport limits without losing its anchor', () => {
  assert.deepEqual(
    zoomDrawingViewport({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 100 }, 100),
    { x: -200, y: -200, zoom: 3 },
  )
  assert.deepEqual(
    zoomDrawingViewport({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 100 }, 0.01),
    { x: 75, y: 75, zoom: 0.25 },
  )
})

test('panning applies wheel deltas without changing zoom', () => {
  assert.deepEqual(
    panDrawingViewport({ x: 30, y: 20, zoom: 1.5 }, 12, -8),
    { x: 18, y: 28, zoom: 1.5 },
  )
})

test('fitting centers content with padding and caps enlargement', () => {
  assert.deepEqual(
    fitDrawingViewport({ x: -100, y: 50, width: 400, height: 200 }, { width: 800, height: 600 }),
    { x: 250, y: 75, zoom: 1.5 },
  )
})

test('fitting an empty board restores a fresh default viewport', () => {
  const fitted = fitDrawingViewport(null, { width: 800, height: 600 })
  assert.deepEqual(fitted, DEFAULT_DRAWING_VIEWPORT)
  assert.notEqual(fitted, DEFAULT_DRAWING_VIEWPORT)
})
