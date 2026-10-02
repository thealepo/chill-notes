import assert from 'node:assert/strict'
import test from 'node:test'
import {
  elementBounds,
  parseDrawingScene,
  resizeElementFromBounds,
  type DrawingShapeElement,
} from '../src/lib/drawingScene.ts'

function sceneWithShape(type: 'line' | 'arrow', width: number, height: number): string {
  return JSON.stringify({
    type: 'chill-drawing',
    version: 1,
    paper: 'dot',
    elements: [{
      id: 'shape',
      type,
      x: 120,
      y: 80,
      width,
      height,
      strokeColor: '#493d40',
      strokeWidth: 3,
      opacity: 1,
    }],
  })
}

test('drawing parser preserves line direction in every quadrant', () => {
  for (const [width, height] of [[60, 40], [-60, 40], [60, -40], [-60, -40]]) {
    const [line] = parseDrawingScene(sceneWithShape('line', width, height)).elements

    assert.equal(line.width, width)
    assert.equal(line.height, height)
  }
})

test('drawing parser preserves arrow direction in every quadrant', () => {
  for (const [width, height] of [[60, 40], [-60, 40], [60, -40], [-60, -40]]) {
    const [arrow] = parseDrawingScene(sceneWithShape('arrow', width, height)).elements

    assert.equal(arrow.width, width)
    assert.equal(arrow.height, height)
  }
})

function shape(type: 'line' | 'arrow', width: number, height: number): DrawingShapeElement {
  return {
    id: 'shape',
    type,
    x: 120,
    y: 80,
    width,
    height,
    strokeColor: '#493d40',
    strokeWidth: 3,
    opacity: 1,
  }
}

test('resizing lines and arrows preserves their horizontal and vertical direction', () => {
  for (const type of ['line', 'arrow'] as const) {
    for (const [width, height] of [[60, 40], [-60, 40], [60, -40], [-60, -40]]) {
      const original = shape(type, width, height)
      const originalBounds = elementBounds(original)
      const resized = resizeElementFromBounds(original, 100, 70)

      assert.equal(Math.sign(resized.width), Math.sign(width))
      assert.equal(Math.sign(resized.height), Math.sign(height))
      assert.equal(Math.abs(resized.width), 100)
      assert.equal(Math.abs(resized.height), 70)
      assert.equal(
        width < 0 ? resized.x + resized.width : resized.x,
        originalBounds.x,
        'the horizontally opposite endpoint remains anchored',
      )
      assert.equal(
        height < 0 ? resized.y + resized.height : resized.y,
        originalBounds.y,
        'the vertically opposite endpoint remains anchored',
      )
    }
  }
})
