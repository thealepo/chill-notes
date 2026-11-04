import assert from 'node:assert/strict'
import test from 'node:test'
import {
  duplicateNoteBlock,
  insertNoteBlock,
  mergeNoteBlockIntoPrevious,
  moveNoteBlock,
  numberedNoteBlockPosition,
  removeNoteBlock,
  reorderNoteBlock,
  updateNoteBlock,
} from '../src/lib/noteBlocks.ts'
import type { NoteBlock } from '../src/types.ts'

const blocks: NoteBlock[] = [
  { id: 'a', kind: 'text', content: 'Alpha' },
  { id: 'b', kind: 'numbered', content: 'Beta' },
  { id: 'c', kind: 'numbered', content: 'Gamma' },
]

test('updates and inserts blocks immutably, including a same-commit current patch', () => {
  const updated = updateNoteBlock(blocks, 'a', { content: 'Changed' })
  assert.equal(updated[0].content, 'Changed')
  assert.equal(blocks[0].content, 'Alpha')

  const inserted = insertNoteBlock(
    blocks,
    'checklist',
    'a',
    { content: 'Todo', patchCurrent: { kind: 'divider', content: '' } },
    () => 'new',
  )
  assert.deepEqual(inserted.blocks.map((block) => block.id), ['a', 'new', 'b', 'c'])
  assert.deepEqual(inserted.blocks[0], { id: 'a', kind: 'divider', content: '' })
  assert.deepEqual(inserted.block, { id: 'new', kind: 'checklist', content: 'Todo', checked: false })
})

test('removal preserves one editable block and focuses the preceding block otherwise', () => {
  const only = removeNoteBlock([{ id: 'only', kind: 'quote', content: 'Text' }], 'only')
  assert.deepEqual(only, {
    blocks: [{ id: 'only', kind: 'text', content: '', checked: false }],
    focusId: 'only',
  })

  const removed = removeNoteBlock(blocks, 'b')
  assert.deepEqual(removed?.blocks.map((block) => block.id), ['a', 'c'])
  assert.equal(removed?.focusId, 'a')
})

test('duplicate, keyboard move, and drag reorder retain the original objects', () => {
  const duplicated = duplicateNoteBlock(blocks, 'b', () => 'copy')
  assert.deepEqual(duplicated?.blocks.map((block) => block.id), ['a', 'b', 'copy', 'c'])
  assert.equal(duplicated?.block.content, 'Beta')

  assert.deepEqual(moveNoteBlock(blocks, 'b', -1).map((block) => block.id), ['b', 'a', 'c'])
  assert.deepEqual(reorderNoteBlock(blocks, 'a', 'c', 'after').map((block) => block.id), ['b', 'c', 'a'])
  assert.strictEqual(moveNoteBlock(blocks, 'a', -1), blocks)
})

test('merges content at the previous caret junction and counts consecutive numbered blocks', () => {
  const merged = mergeNoteBlockIntoPrevious(blocks, 'b')
  assert.deepEqual(merged?.blocks.map((block) => block.content), ['AlphaBeta', 'Gamma'])
  assert.equal(merged?.focusId, 'a')
  assert.equal(merged?.caret, 5)
  assert.equal(numberedNoteBlockPosition(blocks, 2), 2)
  assert.equal(numberedNoteBlockPosition(blocks, 1), 1)
})
