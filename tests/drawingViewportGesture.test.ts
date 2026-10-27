import assert from 'node:assert/strict'
import test from 'node:test'
import {
  beginViewportGesture,
  updateViewportGesture,
} from '../src/lib/drawingViewportGesture.ts'

test('two-finger movement pans the viewport without changing zoom', () => {
  const gesture = beginViewportGesture(
    { x: 40, y: 30, zoom: 1 },
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  )
  const viewport = updateViewportGesture(
    gesture,
    { x: 135, y: 80 },
    { x: 235, y: 80 },
    0.25,
    3,
  )

  assert.deepEqual(viewport, { x: 75, y: 10, zoom: 1 })
})

test('pinching keeps the original midpoint world position under the moving midpoint', () => {
  const gesture = beginViewportGesture(
    { x: 20, y: 10, zoom: 1 },
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  )
  const viewport = updateViewportGesture(
    gesture,
    { x: 70, y: 120 },
    { x: 270, y: 120 },
    0.25,
    3,
  )

  assert.deepEqual(viewport, { x: -90, y: -60, zoom: 2 })
  assert.equal((170 - viewport.x) / viewport.zoom, gesture.worldAnchor.x)
  assert.equal((120 - viewport.y) / viewport.zoom, gesture.worldAnchor.y)
})

test('pinch zoom respects minimum and maximum viewport limits', () => {
  const gesture = beginViewportGesture(
    { x: 0, y: 0, zoom: 1 },
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  )

  assert.equal(updateViewportGesture(gesture, { x: 49, y: 0 }, { x: 51, y: 0 }, 0.25, 3).zoom, 0.25)
  assert.equal(updateViewportGesture(gesture, { x: -500, y: 0 }, { x: 600, y: 0 }, 0.25, 3).zoom, 3)
})

test('coincident touch points produce a finite stable viewport', () => {
  const gesture = beginViewportGesture(
    { x: 12, y: 18, zoom: 1.5 },
    { x: 80, y: 90 },
    { x: 80, y: 90 },
  )
  const viewport = updateViewportGesture(
    gesture,
    { x: 80, y: 90 },
    { x: 80, y: 90 },
    0.25,
    3,
  )

  assert.deepEqual(viewport, { x: 12, y: 18, zoom: 1.5 })
})
