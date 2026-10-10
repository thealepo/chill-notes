import assert from 'node:assert/strict'
import test from 'node:test'
import { createDrawingExportPlan } from '../src/lib/drawingExportPlan.ts'
import type { DrawingElement, DrawingScene } from '../src/lib/drawingScene.ts'

function rectangle(id: string, x: number, y: number, width: number, height: number): DrawingElement {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    strokeColor: '#493d40',
    strokeWidth: 3,
    opacity: 1,
  }
}

function scene(elements: DrawingElement[]): DrawingScene {
  return { type: 'chill-drawing', version: 1, paper: 'dot', elements }
}

test('export bounds fit content across negative coordinates and reversed lines', () => {
  const reversedLine: DrawingElement = {
    ...rectangle('line', 200, 150, -80, -60),
    type: 'line',
  }
  const plan = createDrawingExportPlan(scene([
    rectangle('negative', -120, 50, 40, 120),
    reversedLine,
  ]))

  assert.deepEqual(plan.content, { x: -120, y: 50, width: 320, height: 120 })
  assert.equal(plan.width, 448)
  assert.equal(plan.height, 248)
  assert.deepEqual(plan.viewport, { x: 184, y: 14, zoom: 1 })
  assert.equal(plan.scale, 2)
  assert.equal(plan.pixelWidth, 896)
  assert.equal(plan.pixelHeight, 496)
})

test('export uses a stable default board for an empty scene', () => {
  const plan = createDrawingExportPlan(scene([]))

  assert.deepEqual(plan.content, { x: 0, y: 0, width: 1200, height: 720 })
  assert.equal(plan.width, 1328)
  assert.equal(plan.height, 848)
  assert.equal(plan.pixelWidth, 2656)
  assert.equal(plan.pixelHeight, 1696)
})

test('export omits unavailable images from both rendering and fitted bounds', () => {
  const image: DrawingElement = {
    id: 'legacy-image',
    type: 'image',
    source: 'data:image/png;base64,broken',
    locked: true,
    x: -500,
    y: -400,
    width: 1800,
    height: 1200,
    strokeColor: 'transparent',
    strokeWidth: 1,
    opacity: 1,
  }
  const foreground = rectangle('foreground', 10, 20, 100, 80)
  const original = scene([image, foreground])
  const plan = createDrawingExportPlan(original, new Set(['legacy-image']))

  assert.deepEqual(plan.scene.elements, [foreground])
  assert.deepEqual(plan.content, { x: 10, y: 20, width: 100, height: 80 })
  assert.equal(plan.unavailableImageCount, 1)
  assert.equal(original.elements.length, 2, 'planning does not mutate the saved scene')
})

test('export caps very large scenes at the maximum output dimension', () => {
  const plan = createDrawingExportPlan(scene([
    rectangle('huge', -10_000, -5_000, 25_000, 12_000),
  ]))

  assert.equal(plan.width, 25_128)
  assert.equal(plan.height, 12_128)
  assert.equal(plan.pixelWidth, 4096)
  assert.ok(plan.pixelHeight <= 4096)
  assert.ok(plan.scale < 1)
})
