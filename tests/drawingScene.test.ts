import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDrawingScene } from '../src/lib/drawingScene.ts'

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
