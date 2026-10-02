import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDrawingScene } from '../src/lib/drawingScene.ts'
import {
  mergeStoredWorkspaces,
  normalizeStoredNotes,
  normalizeStoredWorkspace,
  serializeStoredWorkspace,
  type StoredWorkspace,
} from '../src/lib/noteSerialization.ts'
import type { Note } from '../src/types.ts'

function note(id: string, updatedAt: number, title = id): Note {
  return {
    id,
    title,
    updatedAt,
    favorite: false,
    blocks: [{ id: `${id}-block`, kind: 'text', content: title }],
  }
}

test('stored notes discard malformed optional fields without discarding valid content', () => {
  const [normalized] = normalizeStoredNotes([{
    ...note('safe', 1),
    drawing: 42,
    pageIcon: { emoji: '🌸' },
    hasCover: 'yes',
    archived: 1,
  }])

  assert.equal(normalized.id, 'safe')
  assert.equal(normalized.drawing, undefined)
  assert.equal(normalized.pageIcon, undefined)
  assert.equal(normalized.hasCover, undefined)
  assert.equal(normalized.archived, undefined)
  assert.deepEqual(parseDrawingScene(42).elements, [])
})

test('legacy note arrays migrate into the versioned workspace', () => {
  const workspace = normalizeStoredWorkspace([note('legacy', 10)])

  assert.deepEqual(workspace.notes.map((item) => item.id), ['legacy'])
  assert.deepEqual(workspace.tombstones, {})
})

test('cross-tab merge keeps independent edits and the newest same-note edit', () => {
  const local: StoredWorkspace = {
    notes: [note('first', 10), note('shared', 5, 'older')],
    tombstones: {},
  }
  const incoming: StoredWorkspace = {
    notes: [note('shared', 20, 'newer'), note('second', 15)],
    tombstones: {},
  }

  const merged = mergeStoredWorkspaces(local, incoming)

  assert.deepEqual(merged.notes.map((item) => item.id), ['shared', 'second', 'first'])
  assert.equal(merged.notes[0].title, 'newer')
})

test('deletion tombstones prevent stale tabs from resurrecting notes', () => {
  const merged = mergeStoredWorkspaces(
    { notes: [note('deleted', 10), note('kept', 12)], tombstones: {} },
    { notes: [], tombstones: { deleted: 11 } },
  )

  assert.deepEqual(merged.notes.map((item) => item.id), ['kept'])
  assert.equal(merged.tombstones.deleted, 11)
})

test('equal-time conflicts converge regardless of merge direction', () => {
  const first: StoredWorkspace = { notes: [note('shared', 30, 'alpha')], tombstones: {} }
  const second: StoredWorkspace = { notes: [note('shared', 30, 'omega')], tombstones: {} }

  assert.equal(
    serializeStoredWorkspace(mergeStoredWorkspaces(first, second)),
    serializeStoredWorkspace(mergeStoredWorkspaces(second, first)),
  )
})

test('versioned workspace round-trips notes and tombstones', () => {
  const workspace: StoredWorkspace = {
    notes: [note('active', 20)],
    tombstones: { removed: 19 },
  }

  assert.deepEqual(normalizeStoredWorkspace(JSON.parse(serializeStoredWorkspace(workspace))), workspace)
})
