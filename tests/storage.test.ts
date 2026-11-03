import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDrawingScene } from '../src/lib/drawingScene.ts'
import {
  mergeStoredWorkspaces,
  normalizeStoredNotes,
  normalizeStoredWorkspace,
  classifyStoredWorkspaceValue,
  serializeStoredWorkspace,
  type StoredWorkspace,
} from '../src/lib/noteSerialization.ts'
import type { Note } from '../src/types.ts'
import {
  checkStoragePersistence,
  classifyStorageUsage,
  formatStorageSize,
  requestStoragePersistence,
} from '../src/lib/storageUsage.ts'

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
    pageCover: 'glitch',
    hasCover: 'yes',
    archived: 1,
  }])

  assert.equal(normalized.id, 'safe')
  assert.equal(normalized.drawing, undefined)
  assert.equal(normalized.pageIcon, undefined)
  assert.equal(normalized.pageCover, undefined)
  assert.equal('hasCover' in normalized, false)
  assert.equal(normalized.archived, undefined)
  assert.deepEqual(parseDrawingScene(42).elements, [])
})

test('stored notes preserve named covers and migrate the legacy cover flag', () => {
  const [named, legacy] = normalizeStoredNotes([
    { ...note('named', 2), pageIcon: '🌊', pageCover: 'ocean' },
    { ...note('legacy-cover', 1), hasCover: true },
  ])

  assert.equal(named.pageIcon, '🌊')
  assert.equal(named.pageCover, 'ocean')
  assert.equal(legacy.pageCover, 'rose')
  assert.equal('hasCover' in legacy, false)
})

test('stored notes normalize custom page icons during hydration', () => {
  const [trimmed, empty, capped] = normalizeStoredNotes([
    { ...note('trimmed-icon', 3), pageIcon: '  🌊  ' },
    { ...note('empty-icon', 2), pageIcon: ' \n\t ' },
    { ...note('capped-icon', 1), pageIcon: 'abcdefghijklmnop-extra' },
  ])

  assert.equal(trimmed.pageIcon, '🌊')
  assert.equal(empty.pageIcon, undefined)
  assert.equal(capped.pageIcon, 'abcdefghijklmnop')
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

test('IndexedDB reads distinguish an absent workspace from valid data', () => {
  assert.deepEqual(classifyStoredWorkspaceValue(undefined), { kind: 'empty' })

  const workspace: StoredWorkspace = { notes: [note('stored', 20)], tombstones: {} }
  assert.deepEqual(classifyStoredWorkspaceValue(serializeStoredWorkspace(workspace)), {
    kind: 'valid',
    workspace,
  })
})

test('IndexedDB reads retain malformed data for recovery', () => {
  const malformed = '{"type":"chill-notes-workspace","version":1'

  assert.deepEqual(classifyStoredWorkspaceValue(malformed), {
    kind: 'corrupt',
    raw: malformed,
    preserved: false,
  })
  assert.deepEqual(classifyStoredWorkspaceValue(null), {
    kind: 'corrupt',
    raw: 'null',
    preserved: false,
  })
})

test('IndexedDB reads identify unsupported workspace versions without normalizing them', () => {
  const unsupported = JSON.stringify({
    type: 'chill-notes-workspace',
    version: 7,
    notes: [note('future', 30)],
    tombstones: {},
    futureField: 'keep me',
  })

  assert.deepEqual(classifyStoredWorkspaceValue(unsupported), {
    kind: 'unsupported-version',
    raw: unsupported,
    preserved: false,
    version: 7,
  })
})

test('IndexedDB reads treat an unusable current-version envelope as corrupt', () => {
  const unusable = JSON.stringify({
    type: 'chill-notes-workspace',
    version: 1,
    notes: [{ id: 'broken', blocks: 'not-an-array' }],
    tombstones: {},
  })

  assert.equal(classifyStoredWorkspaceValue(unusable).kind, 'corrupt')
})

test('storage usage warns before the browser quota is exhausted', () => {
  const mebibyte = 1024 * 1024
  assert.equal(classifyStorageUsage(20 * mebibyte, 100 * mebibyte)?.pressure, 'ok')
  assert.equal(classifyStorageUsage(76 * mebibyte, 100 * mebibyte)?.pressure, 'warning')
  assert.equal(classifyStorageUsage(91 * mebibyte, 100 * mebibyte)?.pressure, 'critical')
  assert.equal(classifyStorageUsage(95 * 1024 * 1024, 100 * 1024 * 1024)?.pressure, 'critical')
  assert.equal(classifyStorageUsage(0, 0), null)
})

test('storage sizes use compact human-readable units', () => {
  assert.equal(formatStorageSize(512), '512 B')
  assert.equal(formatStorageSize(2 * 1024), '2 KB')
  assert.equal(formatStorageSize(1.5 * 1024 * 1024), '1.5 MB')
  assert.equal(formatStorageSize(2 * 1024 * 1024 * 1024), '2.0 GB')
})

test('storage persistence reports browser capability and current durability', async () => {
  assert.equal(await checkStoragePersistence(undefined), 'unsupported')
  assert.equal(await checkStoragePersistence({
    persisted: async () => false,
    persist: async () => true,
  }), 'available')
  assert.equal(await checkStoragePersistence({
    persisted: async () => true,
    persist: async () => true,
  }), 'persistent')
  assert.equal(await checkStoragePersistence({
    persisted: async () => { throw new Error('blocked') },
    persist: async () => true,
  }), 'error')
})

test('storage persistence requests distinguish grants, denials, and failures', async () => {
  assert.equal(await requestStoragePersistence(undefined), 'unsupported')
  assert.equal(await requestStoragePersistence({
    persisted: async () => false,
    persist: async () => true,
  }), 'persistent')
  assert.equal(await requestStoragePersistence({
    persisted: async () => false,
    persist: async () => false,
  }), 'denied')
  assert.equal(await requestStoragePersistence({
    persisted: async () => false,
    persist: async () => { throw new Error('blocked') },
  }), 'error')
})
