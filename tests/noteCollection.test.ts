import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createBlankNote,
  duplicateNote,
  getVisibleNotes,
  type NoteListOptions,
} from '../src/lib/noteCollection.ts'
import type { Note } from '../src/types.ts'

function note(overrides: Partial<Note> & Pick<Note, 'id'>): Note {
  return {
    title: '',
    favorite: false,
    updatedAt: 0,
    blocks: [{ id: `${overrides.id}-block`, kind: 'text', content: '' }],
    ...overrides,
  }
}

const defaultOptions: NoteListOptions = {
  view: 'notes',
  query: '',
  favoritesOnly: false,
  sortOrder: 'updated',
}

test('creates a deterministic blank note when dependencies are provided', () => {
  const ids = ['note-id', 'block-id']
  const result = createBlankNote(123, () => ids.shift() ?? 'unexpected')

  assert.deepEqual(result, {
    id: 'note-id',
    title: '',
    favorite: false,
    updatedAt: 123,
    blocks: [{ id: 'block-id', kind: 'text', content: '' }],
  })
})

test('duplicates note content and presentation while regenerating every id', () => {
  const original = note({
    id: 'source',
    title: 'Ideas',
    favorite: true,
    archived: true,
    pageIcon: '🌸',
    pageCover: 'rose',
    drawing: '{"type":"chill-drawing"}',
    blocks: [
      { id: 'first', kind: 'heading1', content: 'First' },
      { id: 'second', kind: 'checklist', content: 'Second', checked: true },
    ],
  })
  const ids = ['copy', 'copy-first', 'copy-second']

  const duplicate = duplicateNote(original, 456, () => ids.shift() ?? 'unexpected')

  assert.deepEqual(duplicate, {
    ...original,
    id: 'copy',
    title: 'Ideas copy',
    updatedAt: 456,
    blocks: [
      { id: 'copy-first', kind: 'heading1', content: 'First' },
      { id: 'copy-second', kind: 'checklist', content: 'Second', checked: true },
    ],
  })
  assert.notEqual(duplicate.blocks, original.blocks)
})

test('uses the existing untitled duplicate label', () => {
  assert.equal(duplicateNote(note({ id: 'source' }), 0, () => 'new-id').title, 'Untitled note copy')
})

test('filters notes by view, favorites, title, and block content', () => {
  const notes = [
    note({ id: 'title', title: 'Garden plan', favorite: true, updatedAt: 3 }),
    note({
      id: 'body',
      title: 'Scratchpad',
      favorite: true,
      updatedAt: 2,
      blocks: [{ id: 'body-block', kind: 'text', content: 'Plant lavender' }],
    }),
    note({ id: 'not-favorite', title: 'Garden tools', updatedAt: 4 }),
    note({ id: 'archived', title: 'Old garden', favorite: true, archived: true, updatedAt: 5 }),
  ]

  assert.deepEqual(
    getVisibleNotes(notes, { ...defaultOptions, query: 'garden', favoritesOnly: true }).map(({ id }) => id),
    ['title'],
  )
  assert.deepEqual(
    getVisibleNotes(notes, { ...defaultOptions, query: 'LAVENDER', favoritesOnly: true }).map(({ id }) => id),
    ['body'],
  )
  assert.deepEqual(
    getVisibleNotes(notes, { ...defaultOptions, view: 'archive' }).map(({ id }) => id),
    ['archived'],
  )
})

test('sorts by recency or display title without mutating the source array', () => {
  const notes = [
    note({ id: 'zebra', title: 'Zebra', updatedAt: 2 }),
    note({ id: 'untitled', title: '', updatedAt: 3 }),
    note({ id: 'apple', title: 'Apple', updatedAt: 1 }),
  ]

  assert.deepEqual(getVisibleNotes(notes, defaultOptions).map(({ id }) => id), ['untitled', 'zebra', 'apple'])
  assert.deepEqual(
    getVisibleNotes(notes, { ...defaultOptions, sortOrder: 'title' }).map(({ id }) => id),
    ['apple', 'untitled', 'zebra'],
  )
  assert.deepEqual(notes.map(({ id }) => id), ['zebra', 'untitled', 'apple'])
})
