import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createKeyboardElement,
  drawingElementLabel,
  moveDrawingElement,
  nextEditableElement,
} from '../src/lib/drawingKeyboard.ts'
import { createEmptyDrawingScene, type DrawingElement, type DrawingShapeElement } from '../src/lib/drawingScene.ts'

function shape(id: string, type: DrawingShapeElement['type'] = 'rectangle'): DrawingShapeElement {
  return {
    id,
    type,
    x: 10,
    y: 20,
    width: 80,
    height: 50,
    strokeColor: '#493d40',
    strokeWidth: 4,
    opacity: 1,
  }
}

test('keyboard selection cycles editable elements in both directions and skips locked images', () => {
  const lockedImage: DrawingElement = {
    id: 'background',
    type: 'image',
    source: 'data:image/png;base64,example',
    locked: true,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    strokeColor: 'transparent',
    strokeWidth: 1,
    opacity: 1,
  }
  const scene = {
    ...createEmptyDrawingScene(),
    elements: [shape('first'), lockedImage, shape('second', 'arrow')],
  }

  assert.equal(nextEditableElement(scene, null, 1)?.id, 'first')
  assert.equal(nextEditableElement(scene, null, -1)?.id, 'second')
  assert.equal(nextEditableElement(scene, 'first', 1)?.id, 'second')
  assert.equal(nextEditableElement(scene, 'second', 1)?.id, 'first')
  assert.equal(nextEditableElement(scene, 'first', -1)?.id, 'second')
})

test('keyboard movement preserves element geometry while changing its position', () => {
  const original = shape('selected', 'arrow')
  const moved = moveDrawingElement(original, -10, 1)

  assert.deepEqual(moved, { ...original, x: 0, y: 21 })
  assert.deepEqual(original, shape('selected', 'arrow'), 'the original element remains immutable')
})

test('keyboard creation centers shapes, text, and sticky notes on the requested point', () => {
  const options = {
    id: 'created',
    center: { x: 300, y: 200, pressure: 0.5 },
    color: '#c36e82',
    size: 6,
    stickyIndex: 1,
  }

  const rectangle = createKeyboardElement('rectangle', options)
  const textElement = createKeyboardElement('text', options)
  const sticky = createKeyboardElement('sticky', options)

  assert.deepEqual(
    { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height },
    { x: 220, y: 150, width: 160, height: 100 },
  )
  assert.deepEqual(
    { x: textElement.x, y: textElement.y, width: textElement.width, height: textElement.height },
    { x: 170, y: 164, width: 260, height: 72 },
  )
  assert.equal(sticky.type, 'sticky')
  assert.equal(sticky.fillColor, '#f5cbd5')
  assert.equal(drawingElementLabel(sticky), 'Sticky note')
})

test('keyboard selection reports no result for an empty or image-only scene', () => {
  assert.equal(nextEditableElement(createEmptyDrawingScene(), null, 1), undefined)
})
