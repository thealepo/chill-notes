import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DRAWING_SCENE_VERSION,
  elementBounds,
  elementsForCanvasPaint,
  parseDrawingScene,
  parseDrawingSceneResult,
  resizeElementFromBounds,
  type DrawingElement,
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

test('drawing parser accepts only the current scene version', () => {
  const current = JSON.parse(sceneWithShape('arrow', 60, 40)) as Record<string, unknown>
  assert.equal(parseDrawingScene(JSON.stringify(current)).elements.length, 1)
  assert.equal(parseDrawingScene(JSON.stringify(current)).version, DRAWING_SCENE_VERSION)

  for (const version of [0, 2, '1', null, undefined]) {
    const candidate = { ...current, version }
    const parsed = parseDrawingScene(JSON.stringify(candidate))

    assert.equal(parsed.version, DRAWING_SCENE_VERSION)
    assert.deepEqual(parsed.elements, [])
  }
})

test('drawing parser reports unsupported versions so stored data can remain read-only', () => {
  const future = {
    ...(JSON.parse(sceneWithShape('arrow', 60, 40)) as Record<string, unknown>),
    version: DRAWING_SCENE_VERSION + 1,
  }
  const result = parseDrawingSceneResult(JSON.stringify(future))

  assert.equal(result.status, 'unsupported-version')
  assert.deepEqual(result.scene.elements, [])
  if (result.status === 'unsupported-version') {
    assert.equal(result.version, DRAWING_SCENE_VERSION + 1)
  }

  const changedFutureSchema = parseDrawingSceneResult(JSON.stringify({
    type: 'chill-drawing',
    version: DRAWING_SCENE_VERSION + 1,
    objects: { shape: { type: 'future-shape' } },
  }))
  assert.equal(changedFutureSchema.status, 'unsupported-version')
})

test('canvas paint elements do not duplicate text under the active editor', () => {
  const elements: DrawingElement[] = [
    {
      id: 'plain-text',
      type: 'text',
      x: 10,
      y: 20,
      width: 260,
      height: 72,
      strokeColor: '#493d40',
      strokeWidth: 4,
      opacity: 1,
      text: 'Rendered once',
      fontSize: 22,
    },
    {
      id: 'sticky-text',
      type: 'sticky',
      x: 40,
      y: 50,
      width: 220,
      height: 150,
      strokeColor: '#493d40',
      strokeWidth: 4,
      opacity: 1,
      text: 'Also rendered once',
      fontSize: 18,
      fillColor: '#f7d9a7',
    },
  ]

  assert.strictEqual(elementsForCanvasPaint(elements, null), elements)
  assert.deepEqual(elementsForCanvasPaint(elements, 'plain-text'), [elements[1]])
  assert.deepEqual(elementsForCanvasPaint(elements, 'sticky-text'), [elements[0], { ...elements[1], text: '' }])
  assert.equal(elements[1].type === 'sticky' ? elements[1].text : '', 'Also rendered once')
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
