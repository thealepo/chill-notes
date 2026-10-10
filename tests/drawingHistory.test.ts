import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendDrawingHistory,
  DRAWING_HISTORY_LIMIT,
  stepDrawingHistory,
} from '../src/lib/drawingHistory.ts'
import type { DrawingScene } from '../src/lib/drawingScene.ts'

function scene(revision: number): DrawingScene {
  return {
    type: 'chill-drawing',
    version: 1,
    paper: 'dot',
    elements: revision === 0 ? [] : [{
      id: `revision-${revision}`,
      type: 'rectangle',
      x: revision,
      y: revision,
      width: 100,
      height: 60,
      strokeColor: '#493d40',
      strokeWidth: 3,
      opacity: 1,
    }],
  }
}

function revisionOf(value: DrawingScene): number {
  const id = value.elements[0]?.id
  return id ? Number(id.replace('revision-', '')) : 0
}

test('drawing history retains only the newest sixty committed scenes', () => {
  let entries = [scene(0)]
  let index = 0

  for (let revision = 1; revision <= 75; revision += 1) {
    const update = appendDrawingHistory(entries, index, scene(revision))
    entries = update.entries
    index = update.index
  }

  assert.equal(entries.length, DRAWING_HISTORY_LIMIT)
  assert.equal(index, DRAWING_HISTORY_LIMIT - 1)
  assert.equal(revisionOf(entries[0]), 16)
  assert.equal(revisionOf(entries.at(-1)!), 75)
})

test('undo and redo stop cleanly at retained history boundaries', () => {
  const entries = [scene(1), scene(2), scene(3)]

  assert.equal(stepDrawingHistory(entries, 0, -1), null)
  assert.equal(stepDrawingHistory(entries, 2, 1), null)
  assert.equal(revisionOf(stepDrawingHistory(entries, 2, -1)!.scene), 2)
  assert.equal(revisionOf(stepDrawingHistory(entries, 0, 1)!.scene), 2)
})

test('committing after undo discards the redo branch', () => {
  const entries = [scene(1), scene(2), scene(3), scene(4)]
  const update = appendDrawingHistory(entries, 1, scene(20))

  assert.deepEqual(update.entries.map(revisionOf), [1, 2, 20])
  assert.equal(update.index, 2)
  assert.equal(stepDrawingHistory(update.entries, update.index, 1), null)
})

test('history snapshots remain isolated from later scene mutations', () => {
  const next = scene(2)
  const update = appendDrawingHistory([scene(1)], 0, next)
  next.elements[0].x = 999

  assert.equal(update.entries[1].elements[0].x, 2)
  const undone = stepDrawingHistory(update.entries, 1, -1)!
  undone.scene.paper = 'blank'
  assert.equal(update.entries[0].paper, 'dot')
})
