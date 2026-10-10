import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DRAWING_SCENE_VERSION,
  elementBounds,
  elementsForCanvasPaint,
  normalizedStroke,
  parseDrawingScene,
  parseDrawingSceneResult,
  resizeElementFromBounds,
  sceneContentBounds,
  type DrawingElement,
  type DrawingPoint,
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

test('resizing regular shapes stays anchored and enforces minimum dimensions', () => {
  const original: DrawingElement = {
    id: 'rectangle',
    type: 'rectangle',
    x: -40,
    y: 25,
    width: 120,
    height: 90,
    strokeColor: '#493d40',
    strokeWidth: 3,
    opacity: 1,
  }
  const resized = resizeElementFromBounds(original, -100, 0)

  assert.equal(resized.x, -40)
  assert.equal(resized.y, 25)
  assert.equal(resized.width, 12)
  assert.equal(resized.height, 12)
  assert.deepEqual(original, { ...original, width: 120, height: 90 }, 'resize is immutable')
})

test('resizing pressure strokes preserves normalized points and style', () => {
  const original = normalizedStroke('pen', [
    { x: 10, y: 20, pressure: 0.2 },
    { x: 30, y: 50, pressure: 0.8 },
  ], '#7a4054', 7)
  const resized = resizeElementFromBounds(original, 400, 160)

  assert.equal(resized.type, 'pen')
  assert.equal(resized.width, 400)
  assert.equal(resized.height, 160)
  assert.equal(resized.strokeColor, '#7a4054')
  assert.equal(resized.strokeWidth, 7)
  assert.deepEqual(resized.type === 'pen' ? resized.points : [], original.points)
  assert.notStrictEqual(resized, original)
})

test('large scenes parse and compute bounds without spread-argument limits', () => {
  const elementCount = 12_000
  const elements = Array.from({ length: elementCount }, (_, index) => ({
    id: `shape-${index}`,
    type: 'rectangle',
    x: index * 2 - 1_000,
    y: index % 100 * 3 - 50,
    width: 10,
    height: 20,
    strokeColor: '#493d40',
    strokeWidth: 3,
    opacity: 1,
  }))
  const parsed = parseDrawingScene(JSON.stringify({
    type: 'chill-drawing',
    version: DRAWING_SCENE_VERSION,
    paper: 'grid',
    elements,
  }))

  assert.equal(parsed.elements.length, elementCount)
  assert.equal(parsed.paper, 'grid')
  assert.deepEqual(sceneContentBounds(parsed), {
    x: -1_000,
    y: -50,
    width: 24_008,
    height: 317,
  })
})

test('normalizing a very large pressure stroke remains stack safe', () => {
  const points: DrawingPoint[] = Array.from({ length: 25_000 }, (_, index) => ({
    x: index - 5_000,
    y: index % 250 - 125,
    pressure: (index % 10) / 10,
  }))
  const stroke = normalizedStroke('highlighter', points, '#e2a83f', 6)

  assert.equal(stroke.points.length, points.length)
  assert.equal(stroke.x, -5_000)
  assert.equal(stroke.y, -125)
  assert.equal(stroke.width, 24_999)
  assert.equal(stroke.height, 249)
  assert.deepEqual(stroke.points[0], { x: 0, y: 0, pressure: 0 })
  assert.deepEqual(stroke.points.at(-1), { x: 1, y: 1, pressure: 0.9 })
})
