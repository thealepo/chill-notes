import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDrawingScene } from '../src/lib/drawingScene.ts'
import { parseImportedNotes, serializeNotesExport } from '../src/lib/noteSerialization.ts'
import type { Note } from '../src/types.ts'

test('JSON backup round-trips drawings and presentation metadata with fresh IDs', () => {
  const drawing = JSON.stringify({
    type: 'chill-drawing',
    version: 1,
    paper: 'grid',
    elements: [{
      id: 'shape-1',
      type: 'rectangle',
      x: 12,
      y: 24,
      width: 180,
      height: 90,
      strokeColor: '#493d40',
      strokeWidth: 3,
      opacity: 1,
    }],
  })
  const original: Note = {
    id: 'portable-note',
    title: 'Portable workspace',
    updatedAt: 1_700_000_000_000,
    favorite: true,
    archived: true,
    pageIcon: '🌸',
    hasCover: true,
    drawing,
    blocks: [
      { id: 'heading', kind: 'heading2', content: 'Preserved content' },
      { id: 'task', kind: 'checklist', content: 'Pack the drawing', checked: true },
    ],
  }

  const backup = serializeNotesExport([original])
  assert.deepEqual(JSON.parse(backup), [original])

  const result = parseImportedNotes(backup)
  assert.equal(result.skipped, 0)
  assert.equal(result.notes.length, 1)
  const [restored] = result.notes
  assert.notEqual(restored.id, original.id)
  assert.notEqual(restored.blocks[0].id, original.blocks[0].id)
  assert.deepEqual({ ...restored, id: original.id, blocks: original.blocks }, original)
  assert.equal(parseDrawingScene(restored.drawing).elements[0]?.type, 'rectangle')
})
